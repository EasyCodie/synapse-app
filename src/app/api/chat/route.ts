import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import {
  searchResources,
  createFlashcards,
  createTask,
  getUpcomingDeadlines,
  summarizeResource,
  listResources,
} from "@/lib/ai-tools";

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
            "Generate a concise chat title for an IB student conversation. Return only the title, no quotes, no punctuation at the end. Use 3-6 words.",
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

// ─── System Prompt (placed at start for serial position primacy) ────────────────
const SYSTEM_PROMPT = `You are Synapse AI, an intelligent study assistant for IB Diploma Programme students. You help students understand their notes, resources, and course material.

You have access to tools that let you:
1. **search_resources** — semantic search across the student's uploaded content. Use when asking about specific TOPICS (e.g. "what do my notes say about mitosis?").
2. **summarize_resource** — retrieve the FULL text of a specific uploaded document by title or ID. Use when the student asks to "summarize my latest upload", "summarize [title]", or references a specific document. This tool fetches from the database directly (no embedding search needed).
3. **list_resources** — list ALL uploaded resources with titles, types, and dates. Use when the student asks "what resources do I have?", "what have I uploaded?", "show my files", or wants an overview of their library.
4. **create_flashcards** — generate flashcard sets for spaced repetition study.
5. **create_task** — add items to the student's task list with due dates and priorities.
6. **get_upcoming_deadlines** — look up upcoming tasks and milestones.

CRITICAL TOOL ROUTING RULES:
- When the student asks "what resources do I have?" or "what have I uploaded?" or "list my uploads" → use list_resources (NOT search_resources).
- When the student says "summarize my latest upload" or "summarize [title]" → use summarize_resource (NOT search_resources).
- When the student asks about a TOPIC (e.g. "explain AGEs" or "what is lipid peroxidation?") → use search_resources.
- When the student says "create flashcards" → first use search_resources or summarize_resource to get content, then use create_flashcards.
- When citing information from search results, use [Source N] notation.
- When the latest user message includes attached resource context, prioritize those attached resources over broad search and cite them as [Attached Resource N].
- Be concise, clear, and educational in your responses.
- Use markdown formatting for structure (headings, bullet points, bold) when helpful.
- When creating flashcards, make them specific, testable, and pedagogically sound.
- When creating tasks, infer reasonable due dates and priorities from context.
- If you can't find relevant content via search, suggest the student upload materials on that topic.`;

// ─── Tool Schemas ───────────────────────────────────────────────────────────────
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_resources",
      description:
        "Search the student's uploaded resources, notes, and study materials using semantic similarity. Use this whenever the student asks about academic content.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query — what to look for in the student's resources",
          },
          limit: {
            type: "number",
            description: "Max results to return (default 6)",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_flashcards",
      description:
        "Create flashcards for spaced repetition study. Generate multiple cards with clear front (question/prompt) and back (answer) pairs.",
      parameters: {
        type: "object",
        properties: {
          flashcards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                front: { type: "string", description: "Question or prompt" },
                back: { type: "string", description: "Answer or explanation" },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Topic tags for organization",
                },
              },
              required: ["front", "back"],
            },
            description: "Array of flashcard objects to create",
          },
          subject_id: {
            type: "string",
            description: "Optional subject UUID to associate flashcards with",
          },
        },
        required: ["flashcards"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Create a task or reminder on the student's task list. Use when the student asks to be reminded of something or wants to track a deadline.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Optional details" },
          due_date: {
            type: "string",
            description: "Due date in YYYY-MM-DD format",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Task priority level",
          },
          subject_id: {
            type: "string",
            description: "Optional subject UUID",
          },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_upcoming_deadlines",
      description:
        "Check the student's upcoming tasks and milestones. Use when they ask about what's due soon or need schedule overview.",
      parameters: {
        type: "object",
        properties: {
          days_ahead: {
            type: "number",
            description: "How many days ahead to look (default 7)",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_resource",
      description:
        "Retrieve the full text content of an uploaded document directly from the database. Use this when the student says 'summarize my latest upload', 'summarize [title]', or wants to read a specific document. If no resource_id or title_search is provided, returns the MOST RECENTLY uploaded resource.",
      parameters: {
        type: "object",
        properties: {
          resource_id: {
            type: "string",
            description: "UUID of the resource (if known)",
          },
          title_search: {
            type: "string",
            description: "Search by title (partial match). Leave empty to get the most recent upload.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_resources",
      description:
        "List all uploaded resources in the student's library. Returns titles, file types, upload dates, and indexing status. Use when the student asks 'what resources do I have?', 'what have I uploaded?', 'show my files', or wants an overview of their resource library.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Max resources to return (default 20)",
          },
          subject_id: {
            type: "string",
            description: "Optional subject UUID to filter by",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

// ─── Route Handler ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      conversation_id: conversationId,
      role: "user",
      content: message,
      sources: attachmentSources.length > 0 ? attachmentSources : null,
    });

    await supabase
      .from("chat_conversations")
      .update({
        title: conversationTitle,
        updated_at: now,
        last_message_at: now,
      })
      .eq("id", conversationId)
      .eq("user_id", user.id);

    // 2. Load chat history from DB (last 20 for LLM context)
    const { data: historyRows } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(21); // 20 history + the message we just inserted

    // Build messages array: system prompt (primacy) + history + new message (recency)
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
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
          const maxLoops = 5;

          while (loopCount < maxLoops) {
            loopCount++;

            const response = await openai.chat.completions.create({
              model: CHAT_MODEL,
              messages: currentMessages,
              tools: TOOLS,
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
                    result = await searchResources(supabase, user.id, toolArgs as Parameters<typeof searchResources>[2]);
                    break;
                  case "create_flashcards":
                    result = await createFlashcards(supabase, user.id, toolArgs as Parameters<typeof createFlashcards>[2]);
                    break;
                  case "create_task":
                    result = await createTask(supabase, user.id, toolArgs as Parameters<typeof createTask>[2]);
                    break;
                  case "get_upcoming_deadlines":
                    result = await getUpcomingDeadlines(supabase, user.id, toolArgs as Parameters<typeof getUpcomingDeadlines>[2]);
                    break;
                  case "summarize_resource":
                    result = await summarizeResource(supabase, user.id, toolArgs as Parameters<typeof summarizeResource>[2]);
                    break;
                  case "list_resources":
                    result = await listResources(supabase, user.id, toolArgs as Parameters<typeof listResources>[2]);
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
            await supabase.from("chat_messages").insert({
              user_id: user.id,
              conversation_id: conversationId,
              role: "assistant",
              content: fullContent,
              tool_calls: toolCallsLog.length > 0 ? toolCallsLog : null,
            });

            await supabase
              .from("chat_conversations")
              .update({
                updated_at: new Date().toISOString(),
                last_message_at: new Date().toISOString(),
              })
              .eq("id", conversationId)
              .eq("user_id", user.id);

            // Send done event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
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
