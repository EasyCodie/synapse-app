// ─── Database Types ───────────────────────────────────────────────────────────
// These mirror the Supabase PostgreSQL schema.
// Run `supabase gen types typescript` to regenerate from a live project.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          exam_session: string | null;
          onboarding_complete: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          exam_session?: string | null;
          onboarding_complete?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          exam_session?: string | null;
          onboarding_complete?: boolean;
          created_at?: string;
        };
      };
      user_subjects: {
        Row: {
          id: string;
          user_id: string;
          subject_name: string;
          subject_group: number;
          level: "HL" | "SL";
          language: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_name: string;
          subject_group: number;
          level: "HL" | "SL";
          language?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_name?: string;
          subject_group?: number;
          level?: "HL" | "SL";
          language?: string;
          created_at?: string;
        };
      };
      workspaces: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string | null;
          structure: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id?: string | null;
          structure: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string | null;
          structure?: Json;
          created_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string | null;
          title: string;
          content: Json | null;
          content_text: string | null;
          folder_path: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id?: string | null;
          title: string;
          content?: Json | null;
          content_text?: string | null;
          folder_path?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string | null;
          title?: string;
          content?: Json | null;
          content_text?: string | null;
          folder_path?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      syllabus_progress: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          topic_id: string;
          completed: boolean;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          topic_id: string;
          completed?: boolean;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string;
          topic_id?: string;
          completed?: boolean;
          notes?: string | null;
          updated_at?: string;
        };
      };
      internal_assessments: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          title: string | null;
          status: "not_started" | "research" | "drafting" | "revision" | "submitted";
          due_date: string | null;
          word_count: number;
          target_word_count: number | null;
          draft_versions: Json;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          title?: string | null;
          status?: "not_started" | "research" | "drafting" | "revision" | "submitted";
          due_date?: string | null;
          word_count?: number;
          target_word_count?: number | null;
          draft_versions?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string;
          title?: string | null;
          status?: "not_started" | "research" | "drafting" | "revision" | "submitted";
          due_date?: string | null;
          word_count?: number;
          target_word_count?: number | null;
          draft_versions?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string | null;
          title: string;
          description: string | null;
          due_date: string | null;
          due_time: string | null;
          priority: "low" | "medium" | "high" | "urgent";
          completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id?: string | null;
          title: string;
          description?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          priority?: "low" | "medium" | "high" | "urgent";
          completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string | null;
          title?: string;
          description?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          priority?: "low" | "medium" | "high" | "urgent";
          completed?: boolean;
          created_at?: string;
        };
      };
      milestones: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          date: string;
          type: "exam" | "ia_deadline" | "ee_deadline" | "tok_deadline" | "custom";
          subject_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          date: string;
          type: "exam" | "ia_deadline" | "ee_deadline" | "tok_deadline" | "custom";
          subject_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          date?: string;
          type?: "exam" | "ia_deadline" | "ee_deadline" | "tok_deadline" | "custom";
          subject_id?: string | null;
          created_at?: string;
        };
      };
      resources: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string | null;
          title: string;
          type: "pdf" | "web_clip" | "scan" | "image" | "other";
          file_path: string | null;
          file_size: number | null;
          url: string | null;
          tags: string[];
          content_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id?: string | null;
          title: string;
          type: "pdf" | "web_clip" | "scan" | "image" | "other";
          file_path?: string | null;
          file_size?: number | null;
          url?: string | null;
          tags?: string[];
          content_text?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string | null;
          title?: string;
          type?: "pdf" | "web_clip" | "scan" | "image" | "other";
          file_path?: string | null;
          file_size?: number | null;
          url?: string | null;
          tags?: string[];
          content_text?: string | null;
          created_at?: string;
        };
      };
      chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          sources: Json | null;
          tool_calls: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          sources?: Json | null;
          tool_calls?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          conversation_id?: string;
          role?: "user" | "assistant";
          content?: string;
          sources?: Json | null;
          tool_calls?: Json | null;
          created_at?: string;
        };
      };
      embeddings: {
        Row: {
          id: string;
          user_id: string;
          source_type: "note" | "resource" | "ia";
          source_id: string;
          chunk_index: number;
          content_text: string;
          embedding: number[] | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: "note" | "resource" | "ia";
          source_id: string;
          chunk_index?: number;
          content_text: string;
          embedding?: number[] | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_type?: "note" | "resource" | "ia";
          source_id?: string;
          chunk_index?: number;
          content_text?: string;
          embedding?: number[] | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      ee_tracker: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          subject: string | null;
          supervisor: string | null;
          word_count: number;
          status: string;
          milestones: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          subject?: string | null;
          supervisor?: string | null;
          word_count?: number;
          status?: string;
          milestones?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          subject?: string | null;
          supervisor?: string | null;
          word_count?: number;
          status?: string;
          milestones?: Json;
          created_at?: string;
        };
      };
      tok_tracker: {
        Row: {
          id: string;
          user_id: string;
          essay_title: string | null;
          prescribed_title: string | null;
          exhibition_objects: Json;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          essay_title?: string | null;
          prescribed_title?: string | null;
          exhibition_objects?: Json;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          essay_title?: string | null;
          prescribed_title?: string | null;
          exhibition_objects?: Json;
          status?: string;
          created_at?: string;
        };
      };
      cas_experiences: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          type: "creativity" | "activity" | "service";
          description: string | null;
          learning_outcomes: Json;
          reflections: Json;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          type: "creativity" | "activity" | "service";
          description?: string | null;
          learning_outcomes?: Json;
          reflections?: Json;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          type?: "creativity" | "activity" | "service";
          description?: string | null;
          learning_outcomes?: Json;
          reflections?: Json;
          status?: string;
          created_at?: string;
        };
      };
      flashcards: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string | null;
          resource_id: string | null;
          front: string;
          back: string;
          tags: string[];
          confidence: number;
          next_review: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id?: string | null;
          resource_id?: string | null;
          front: string;
          back: string;
          tags?: string[];
          confidence?: number;
          next_review?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string | null;
          resource_id?: string | null;
          front?: string;
          back?: string;
          tags?: string[];
          confidence?: number;
          next_review?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search_embeddings: {
        Args: {
          query_embedding: number[];
          match_user_id: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: Array<{
          id: string;
          source_type: string;
          source_id: string;
          content_text: string;
          metadata: Json;
          similarity: number;
        }>;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
