import { createClient } from "@/lib/local/client";
import OpenAI from "openai";
import {
  searchResources,
  createFlashcards,
  createTask,
  getUpcomingDeadlines,
  summarizeResource,
  listResources,
  deleteTask,
  updateTask,
  listTasks,
  deleteFlashcards,
  getMySubjects,
  getIAStatus,
  getSyllabusProgress,
  listNotes,
  getRoadmapOverview,
  findRoadmapItems,
  createRoadmapItem,
  updateRoadmapItem,
  splitRoadmapItem,
  linkRoadmapItem,
  regenerateRoadmap,
} from "@/lib/ai-tools";
import { buildSystemPrompt } from "@/lib/ai-system-prompt";
import { AI_TOOLS } from "@/lib/ai-tool-schemas";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.4-nano-2026-03-17";
const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_CHARS = 6000;

function createConversationTitle(message: string) {
  const compact = message.replace(/\s+/g, " ").trim();
  if (!compact) return "New chat";

  const words = compact.split(" ").slice(0, 8).join(" ");
  return words.length > 80 ? `${words.slice(0, 77)}...` : words;
}

async function generateConversationTitle(openai: OpenAI, message: string) {
  try {
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Generate a concise chat title for the conversation. Return only the title, no quotes, no punctuation at the end. Use 3-6 words.",
        },
        { role: "user", content: message.slice(0, 1200) },
      ],
      temperature: 0.2,
      max_completion_tokens: 24,
    });

    const title = completion.choices[0]?.message?.content
      ?.replace(/^['\"]|['\"]$/g, "")
      .replace(/[.!?]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!title) return createConversationTitle(message);
    return title.length > 80 ? `${title.slice(0, 77)}...` : title;
  } catch (err) {
    console.error("Conversation title generation failed:", err);
    return createConversationTitle(message);
  }
}

function parseAttachmentResourceIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  ).slice(0, MAX_ATTACHMENT_COUNT);
}

interface AttachedResource {
  id: string;
  title: string;
  type: string;
  content_text: string | null;
  created_at: string;
}

interface ChatSource {
  index: number;
  source_type: string;
  source_id: string;
  title: string;
  similarity?: number;
  chunk_index?: number;
  word_start?: number;
  word_end?: number;
  heading?: string;
  page_label?: string;
  slide_label?: string;
}

function buildAttachmentContext(resources: AttachedResource[]) {
  if (resources.length === 0) return null;

  return resources
    .map((resource, index) => {
      const content = resource.content_text?.trim()
        ? resource.content_text.trim().slice(0, MAX_ATTACHMENT_CHARS)
        : "[No extracted text is available for this resource yet.]";

      const truncated =
        resource.content_text && resource.content_text.length > MAX_ATTACHMENT_CHARS
          ? `${content}\n[...attachment truncated for length]`
          : content;

      return `[Attached Resource ${index + 1}]\nID: ${resource.id}\nTitle: ${resource.title}\nType: ${resource.type}\nUploaded: ${resource.created_at}\nContent:\n${truncated}`;
    })
    .join("\n\n---\n\n");
}

function extractSearchSources(toolResult: string): ChatSource[] {
  const sources: ChatSource[] = [];
  const sourceRegex = /\[Source\s+(\d+)\]\s+"([^"]+)"\s+\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = sourceRegex.exec(toolResult)) !== null) {
    const details = parseSourceDetails(match[3] ?? "");
    sources.push({
      index: Number(match[1]),
      title: match[2] ?? "Resource",
      similarity: details.similarity,
      source_id: details.source_id,
      source_type: details.source_type,
      chunk_index: details.chunk_index,
      word_start: details.word_start,
      word_end: details.word_end,
      heading: details.heading,
      page_label: details.page_label,
      slide_label: details.slide_label,
    });
  }

  return sources;
}

function parseSourceDetails(details: string): Omit<ChatSource, "index" | "title"> {
  const parsed: Omit<ChatSource, "index" | "title"> = {
    source_id: "",
    source_type: "resource",
  };
  const matchScore = details.match(/(\d+)% match/);
  if (matchScore?.[1]) parsed.similarity = Number(matchScore[1]) / 100;

  for (const rawPart of details.split(",")) {
    const [rawKey, ...rest] = rawPart.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!key || !value) continue;

    if (key === "id") parsed.source_id = value;
    if (key === "type") parsed.source_type = value;
    if (key === "chunk") {
      const chunkIndex = Number.parseInt(value, 10);
      if (Number.isFinite(chunkIndex)) parsed.chunk_index = chunkIndex;
    }
    if (key === "heading") parsed.heading = value;
    if (key === "page") parsed.page_label = value;
    if (key === "slide") parsed.slide_label = value;
    if (key === "words") {
      const [start, end] = value.split("-").map((part) => Number.parseInt(part, 10));
      if (Number.isFinite(start)) parsed.word_start = start - 1;
      if (Number.isFinite(end)) parsed.word_end = end - 1;
    }
  }

  return parsed;
}

// System prompt is now built dynamically via buildSystemPrompt() at request time.
// Tool schemas are imported from src/lib/ai-tool-schemas.ts as AI_TOOLS.

// ─── Route Handler ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const body = (await request.json()) as {
    message?: unknown;
    conversation_id?: unknown;
    attachment_resource_ids?: unknown;
  };
  const message = typeof body.message === "string" ? body.message : "";
  const requestedConversationId =
    typeof body.conversation_id === "string" ? body.conversation_id : null;
  const attachmentResourceIds = parseAttachmentResourceIds(
    body.attachment_resource_ids
  );

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "Message required" }), {
      status: 400,
    });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let attachedResources: AttachedResource[] = [];
    if (attachmentResourceIds.length > 0) {
      const { data, error } = await local
        .from("resources")
        .select("id, title, type, content_text, created_at")
        .eq("user_id", user.id)
        .in("id", attachmentResourceIds);

      if (error) {
        console.error("Attachment resource load error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to load attachments" }),
          { status: 500 }
        );
      }

      const resourcesById = new Map(
        ((data ?? []) as AttachedResource[]).map((resource) => [
          resource.id,
          resource,
        ])
      );
      attachedResources = attachmentResourceIds
        .map((id) => resourcesById.get(id))
        .filter((resource): resource is AttachedResource => Boolean(resource));

      if (attachedResources.length === 0) {
        return new Response(
          JSON.stringify({ error: "No accessible attachments found" }),
          { status: 400 }
        );
      }
    }

    let conversation: {
      id: string;
      title: string;
      created_at: string;
      updated_at: string;
      last_message_at: string;
    } | null = null;

    if (requestedConversationId) {
      const { data, error } = await local
        .from("chat_conversations")
        .select("id, title, created_at, updated_at, last_message_at")
        .eq("id", requestedConversationId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
        });
      }

      conversation = data;
    } else {
      const generatedTitle = await generateConversationTitle(openai, message);
      const { data, error } = await local
        .from("chat_conversations")
        .insert({
          user_id: user.id,
          title: generatedTitle,
        })
        .select("id, title, created_at, updated_at, last_message_at")
        .single();

      if (error || !data) {
        console.error("Conversation create error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to create conversation" }),
          { status: 500 }
        );
      }

      conversation = data;
    }

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Failed to load conversation" }),
        { status: 500 }
      );
    }

    const conversationId = conversation.id;
    const now = new Date().toISOString();
    const conversationTitle =
      conversation.title === "New chat"
        ? await generateConversationTitle(openai, message)
        : conversation.title;
    const attachmentContext = buildAttachmentContext(attachedResources);
    const userMessageForModel = attachmentContext
      ? `${message}\n\nAttached resource context for this turn:\n${attachmentContext}`
      : message;
    const attachmentSources = attachedResources.map((resource, index) => ({
      index: index + 1,
      source_type: "attachment_resource",
      source_id: resource.id,
      title: resource.title,
    }));

    // 1. Save user message to DB
    await local.from("chat_messages").insert({
      user_id: user.id,
      conversation_id: conversationId,
      role: "user",
      content: message,
      sources: attachmentSources.length > 0 ? attachmentSources : null,
    });

    await local
      .from("chat_conversations")
      .update({
        title: conversationTitle,
        updated_at: now,
        last_message_at: now,
      })
      .eq("id", conversationId)
      .eq("user_id", user.id);

    // 2. Load chat history from DB (last 20 for LLM context)
    const { data: historyRows } = await local
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(21); // 20 history + the message we just inserted

    // Build dynamic system prompt with student context
    const systemPrompt = await buildSystemPrompt(user.id, local);

    // Build messages array: system prompt (primacy) + history + new message (recency)
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add history in chronological order (skip the message we just inserted since we'll add it at the end)
    if (historyRows && historyRows.length > 1) {
      const history = historyRows.slice(1).reverse(); // oldest first, skip latest (our new message)
      for (const msg of history) {
        chatMessages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    // Add the new user message at the end (recency)
    chatMessages.push({ role: "user", content: userMessageForModel });

    // 3. Execute with tool calling using manual loop (for streaming support)
    const encoder = new TextEncoder();
    const toolCallsLog: Array<{ name: string; args: unknown; result_summary: string }> = [];
    const semanticSources: ChatSource[] = [];

    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "conversation",
                id: conversationId,
                title: conversationTitle,
              })}\n\n`
            )
          );

          const currentMessages = [...chatMessages];
          let loopCount = 0;
          const maxLoops = 8;

          while (loopCount < maxLoops) {
            loopCount++;

            const response = await openai.chat.completions.create({
              model: CHAT_MODEL,
              messages: currentMessages,
              tools: AI_TOOLS,
              temperature: 0.3,
              max_completion_tokens: 4096,
              stream: true,
            });

            // Collect the full response to check for tool calls
            let fullContent = "";
            const toolCalls: Array<{
              id: string;
              function: { name: string; arguments: string };
            }> = [];

            for await (const chunk of response) {
              const choice = chunk.choices[0];
              if (!choice) continue;

              // Accumulate content
              if (choice.delta?.content) {
                fullContent += choice.delta.content;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "text", text: choice.delta.content })}\n\n`
                  )
                );
              }

              // Accumulate tool calls
              if (choice.delta?.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                  if (tc.index !== undefined) {
                    if (!toolCalls[tc.index]) {
                      toolCalls[tc.index] = {
                        id: tc.id || "",
                        function: { name: "", arguments: "" },
                      };
                    }
                    if (tc.id) toolCalls[tc.index].id = tc.id;
                    if (tc.function?.name)
                      toolCalls[tc.index].function.name += tc.function.name;
                    if (tc.function?.arguments)
                      toolCalls[tc.index].function.arguments += tc.function.arguments;
                  }
                }
              }

              // Check if this is the final chunk
              if (choice.finish_reason === "tool_calls") {
                // Model wants to call tools — process them
                break;
              }

              if (choice.finish_reason === "stop") {
                // Model is done — no more tool calls
                break;
              }
            }

            // If there are tool calls to process
            if (toolCalls.length > 0 && toolCalls[0]?.function?.name) {
              // Add assistant message with tool calls to conversation
              currentMessages.push({
                role: "assistant",
                content: fullContent || null,
                tool_calls: toolCalls.map((tc) => ({
                  id: tc.id,
                  type: "function" as const,
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                })),
              });

              // Execute each tool
              for (const tc of toolCalls) {
                const toolName = tc.function.name;
                let toolArgs: unknown;
                try {
                  toolArgs = JSON.parse(tc.function.arguments);
                } catch {
                  toolArgs = {};
                }

                // Emit tool_start event to client
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "tool_start", name: toolName, args: toolArgs })}\n\n`
                  )
                );

                // Execute the tool
                let result: string;
                switch (toolName) {
                  case "search_resources":
                    result = await searchResources(local, user.id, toolArgs as Parameters<typeof searchResources>[2]);
                    break;
                  case "create_flashcards":
                    result = await createFlashcards(local, user.id, toolArgs as Parameters<typeof createFlashcards>[2]);
                    break;
                  case "create_task":
                    result = await createTask(local, user.id, toolArgs as Parameters<typeof createTask>[2]);
                    break;
                  case "get_upcoming_deadlines":
                    result = await getUpcomingDeadlines(local, user.id, toolArgs as Parameters<typeof getUpcomingDeadlines>[2]);
                    break;
                  case "summarize_resource":
                    result = await summarizeResource(local, user.id, toolArgs as Parameters<typeof summarizeResource>[2]);
                    break;
                  case "list_resources":
                    result = await listResources(local, user.id, toolArgs as Parameters<typeof listResources>[2]);
                    break;
                  case "delete_task":
                    result = await deleteTask(local, user.id, toolArgs as Parameters<typeof deleteTask>[2]);
                    break;
                  case "update_task":
                    result = await updateTask(local, user.id, toolArgs as Parameters<typeof updateTask>[2]);
                    break;
                  case "list_tasks":
                    result = await listTasks(local, user.id, toolArgs as Parameters<typeof listTasks>[2]);
                    break;
                  case "delete_flashcards":
                    result = await deleteFlashcards(local, user.id, toolArgs as Parameters<typeof deleteFlashcards>[2]);
                    break;
                  case "get_my_subjects":
                    result = await getMySubjects(local, user.id);
                    break;
                  case "get_ia_status":
                    result = await getIAStatus(local, user.id, toolArgs as Parameters<typeof getIAStatus>[2]);
                    break;
                  case "get_syllabus_progress":
                    result = await getSyllabusProgress(local, user.id, toolArgs as Parameters<typeof getSyllabusProgress>[2]);
                    break;
                  case "list_notes":
                    result = await listNotes(local, user.id, toolArgs as Parameters<typeof listNotes>[2]);
                    break;
                  case "get_roadmap_overview":
                    result = await getRoadmapOverview(local, user.id, toolArgs as Parameters<typeof getRoadmapOverview>[2]);
                    break;
                  case "find_roadmap_items":
                    result = await findRoadmapItems(local, user.id, toolArgs as Parameters<typeof findRoadmapItems>[2]);
                    break;
                  case "create_roadmap_item":
                    result = await createRoadmapItem(local, user.id, toolArgs as Parameters<typeof createRoadmapItem>[2]);
                    break;
                  case "update_roadmap_item":
                    result = await updateRoadmapItem(local, user.id, toolArgs as Parameters<typeof updateRoadmapItem>[2]);
                    break;
                  case "split_roadmap_item":
                    result = await splitRoadmapItem(local, user.id, toolArgs as Parameters<typeof splitRoadmapItem>[2]);
                    break;
                  case "link_roadmap_item":
                    result = await linkRoadmapItem(local, user.id, toolArgs as Parameters<typeof linkRoadmapItem>[2]);
                    break;
                  case "regenerate_roadmap":
                    result = await regenerateRoadmap(local, user.id, toolArgs as Parameters<typeof regenerateRoadmap>[2]);
                    break;
                  default:
                    result = `Unknown tool: ${toolName}`;
                }

                // Log tool call
                toolCallsLog.push({
                  name: toolName,
                  args: toolArgs,
                  result_summary: result.slice(0, 200),
                });

                if (toolName === "search_resources") {
                  for (const source of extractSearchSources(result)) {
                    const existing = semanticSources.some(
                      (candidate) =>
                        candidate.source_type === source.source_type &&
                        candidate.source_id === source.source_id &&
                        candidate.chunk_index === source.chunk_index
                    );
                    if (!existing) {
                      semanticSources.push({
                        ...source,
                        index: semanticSources.length + 1,
                      });
                    }
                  }
                }

                // Emit tool_result event
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "tool_result", name: toolName, success: !result.startsWith("Failed") && !result.startsWith("Search error") })}\n\n`
                  )
                );

                // Add tool result to conversation
                currentMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: result,
                });
              }

              // Continue the loop — model will generate a response using tool results
              continue;
            }

            // No tool calls — model generated a final response
            // Save assistant message to DB
            await local.from("chat_messages").insert({
              user_id: user.id,
              conversation_id: conversationId,
              role: "assistant",
              content: fullContent,
              sources: semanticSources.length > 0 ? semanticSources : null,
              tool_calls: toolCallsLog.length > 0 ? toolCallsLog : null,
            });

            await local
              .from("chat_conversations")
              .update({
                updated_at: new Date().toISOString(),
                last_message_at: new Date().toISOString(),
              })
              .eq("id", conversationId)
              .eq("user_id", user.id);

            // Send done event
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  sources: semanticSources,
                })}\n\n`
              )
            );
            controller.close();
            return;
          }

          // If we hit max loops, close gracefully
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (err) {
          console.error("Chat stream error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: "AI processing failed" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return new Response(
      JSON.stringify({ error: "AI service unavailable. Please try again." }),
      { status: 500 }
    );
  }
}
