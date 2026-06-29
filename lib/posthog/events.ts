export const EVENTS = {
  // Auth
  USER_SIGNED_UP: "user_signed_up",
  USER_LOGGED_IN: "user_logged_in",
  AUTH_ERROR: "auth_error",
  PASSWORD_RESET_REQUESTED: "password_reset_requested",

  // Dashboard
  DASHBOARD_VIEWED: "dashboard_viewed",
  AI_INSIGHTS_REFRESHED: "ai_insights_refreshed",
  QUICK_ACTION_CLICKED: "quick_action_clicked",

  // Study Planner
  TASK_CREATED: "task_created",
  TASK_COMPLETED: "task_completed",
  TASK_DELETED: "task_deleted",
  AI_STUDY_PLAN_GENERATED: "ai_study_plan_generated",

  // AI Doubt Solver
  DOUBT_SUBMITTED: "doubt_submitted",
  DOUBT_ANSWERED: "doubt_answered",
  DOUBT_SOLVER_ERROR: "doubt_solver_error",

  // AI Chatbot
  CHAT_SESSION_CREATED: "chat_session_created",
  CHAT_MESSAGE_SENT: "chat_message_sent",
  CHAT_SESSION_RENAMED: "chat_session_renamed",
  CHAT_SESSION_DELETED: "chat_session_deleted",

  // Notes
  NOTE_CREATED: "note_created",
  NOTE_SAVED: "note_saved",
  NOTE_DELETED: "note_deleted",
  NOTE_PINNED: "note_pinned",
  NOTE_UNPINNED: "note_unpinned",
  NOTE_EXPORTED_PDF: "note_exported_pdf",
  NOTE_SHARE_LINK_COPIED: "note_share_link_copied",
  AI_NOTES_GENERATED: "ai_notes_generated",
  DRAWING_CANVAS_OPENED: "drawing_canvas_opened",
  DRAWING_SAVED: "drawing_saved",

  // Productivity
  STUDY_SESSION_LOGGED: "study_session_logged",
  STUDY_SESSION_DELETED: "study_session_deleted",
  AI_PRODUCTIVITY_INSIGHTS_REFRESHED: "ai_productivity_insights_refreshed",

  // Mood
  MOOD_LOGGED: "mood_logged",
  MOOD_SUGGESTION_REQUESTED: "mood_suggestion_requested",
  MOOD_ENTRY_DELETED: "mood_entry_deleted",

  // Flashcards
  FLASHCARD_REVIEWED: "flashcard_reviewed",

  // Study Rooms
  STUDY_ROOM_CREATED: "study_room_created",
  STUDY_ROOM_JOINED: "study_room_joined",
  STUDY_ROOM_MESSAGE_SENT: "study_room_message_sent",
  ROOM_TIMER_STARTED: "room_timer_started",
  ROOM_TIMER_STOPPED: "room_timer_stopped",

  // Timetable
  TIMETABLE_SLOT_ADDED: "timetable_slot_added",
  TIMETABLE_SLOT_DELETED: "timetable_slot_deleted",

  // Settings
  THEME_CHANGED: "theme_changed",
  NOTIFICATION_PERMISSION_GRANTED: "notification_permission_granted",
  REMINDERS_TOGGLED: "reminders_toggled",
} as const;
