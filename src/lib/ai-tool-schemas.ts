import type OpenAI from "openai";

/**
 * All 14 tool schemas for Synapse AI function calling.
 *
 * Organized by category:
 * - Resources (3): search_resources, summarize_resource, list_resources
 * - Flashcards (2): create_flashcards, delete_flashcards
 * - Tasks (4): create_task, update_task, delete_task, list_tasks
 * - Deadlines (1): get_upcoming_deadlines
 * - Workspace (4): get_my_subjects, get_ia_status, get_syllabus_progress, list_notes
 */
export const AI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // ─── Resources ──────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "search_resources",
      description:
        "Search the student's uploaded resources using semantic similarity. Use when the student asks about a specific academic topic.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query — what to look for in the student's resources",
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
      name: "summarize_resource",
      description:
        "Retrieve the full text content of an uploaded document. Use when the student says 'summarize my latest upload', 'summarize [title]', or references a specific document. If no resource_id or title_search is provided, returns the most recently uploaded resource.",
      parameters: {
        type: "object",
        properties: {
          resource_id: {
            type: "string",
            description: "UUID of the resource (if known)",
          },
          title_search: {
            type: "string",
            description:
              "Search by title (partial match). Leave empty to get the most recent upload.",
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
        "List all uploaded resources in the student's library. Returns titles, file types, upload dates, and indexing status. Use when the student asks 'what resources do I have?' or wants an overview.",
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

  // ─── Flashcards ─────────────────────────────────────────────────────────────
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
      name: "delete_flashcards",
      description:
        "Delete flashcards by specific IDs or by subject. Always confirm with the student before executing.",
      parameters: {
        type: "object",
        properties: {
          flashcard_ids: {
            type: "array",
            items: { type: "string" },
            description: "Specific flashcard UUIDs to delete",
          },
          subject_id: {
            type: "string",
            description:
              "Delete all flashcards for this subject UUID. Use with caution.",
          },
        },
        additionalProperties: false,
      },
    },
  },

  // ─── Tasks ──────────────────────────────────────────────────────────────────
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
            description: "Optional subject UUID to associate the task with",
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
      name: "update_task",
      description:
        "Update an existing task. Can change title, description, due date, priority, or mark as completed. Requires the task_id — use list_tasks first to find it.",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "UUID of the task to update (required)",
          },
          title: { type: "string", description: "New title" },
          description: { type: "string", description: "New description" },
          due_date: {
            type: "string",
            description: "New due date in YYYY-MM-DD format",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "New priority level",
          },
          completed: {
            type: "boolean",
            description: "Set to true to mark as done, false to reopen",
          },
        },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description:
        "Permanently delete a task. Use task_id if known, or title_search to find by partial title match. Always confirm with the student before executing.",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "UUID of the task to delete",
          },
          title_search: {
            type: "string",
            description:
              "Partial title match to find the task. Returns at most one match for safety.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description:
        "List tasks with optional filters. Returns task IDs, titles, due dates, priorities, and completion status. Use this to look up task IDs before updating or deleting.",
      parameters: {
        type: "object",
        properties: {
          completed: {
            type: "boolean",
            description: "Filter by completion status. Omit to return all.",
          },
          subject_id: {
            type: "string",
            description: "Filter tasks by subject UUID",
          },
          limit: {
            type: "number",
            description: "Max tasks to return (default 20)",
          },
        },
        additionalProperties: false,
      },
    },
  },

  // ─── Deadlines ──────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_upcoming_deadlines",
      description:
        "Get a combined view of upcoming tasks and milestones within a date range. Use when the student asks what's due soon.",
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

  // ─── Workspace ──────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_my_subjects",
      description:
        "Get the student's IB subjects with their UUIDs, names, levels, groups, and languages. Use when you need a subject_id for filtering other tools.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ia_status",
      description:
        "Check Internal Assessment progress. Returns IA titles, subjects, status/stage, word count, and deadlines.",
      parameters: {
        type: "object",
        properties: {
          subject_id: {
            type: "string",
            description:
              "Optional subject UUID to filter. Omit to get all IAs.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_syllabus_progress",
      description:
        "Check topic/unit completion status for a specific subject. Requires a subject_id — use get_my_subjects first if needed.",
      parameters: {
        type: "object",
        properties: {
          subject_id: {
            type: "string",
            description: "Subject UUID to check progress for (required)",
          },
        },
        required: ["subject_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description:
        "List or search the student's notes, optionally filtered by subject or title search.",
      parameters: {
        type: "object",
        properties: {
          subject_id: {
            type: "string",
            description: "Filter notes by subject UUID",
          },
          search: {
            type: "string",
            description: "Search notes by title (partial match)",
          },
          limit: {
            type: "number",
            description: "Max notes to return (default 20)",
          },
        },
        additionalProperties: false,
      },
    },
  },
];
