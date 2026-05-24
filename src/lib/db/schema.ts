import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

// pgvector column — Drizzle doesn't have a first-class type yet
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(v: number[]) {
      return JSON.stringify(v);
    },
    fromDriver(v: string) {
      return JSON.parse(v) as number[];
    },
  })(name);

export const USER_ROLES = ["SA", "T", "S", "SU"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role").notNull().default("SU"), // SA | T | S | SU
  banned: boolean("banned").default(false).notNull(),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userDevices = pgTable(
  "user_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    deviceLabel: text("device_label").notNull(),
    browser: text("browser"),
    os: text("os"),
    lastIpAddress: text("last_ip_address"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    isTrusted: boolean("is_trusted").default(false).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index("user_devices_user_id_idx").on(t.userId),
    fingerprintIdx: index("user_devices_fingerprint_idx").on(t.userId, t.fingerprint),
  })
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled"),
    content: text("content").default(""),
    contentJson: jsonb("content_json"),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ userIdIdx: index("documents_user_id_idx").on(t.userId) })
);

// 768 dims = Gemini text-embedding-004 / nomic-embed-text
// After migration: CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)
export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding", 768).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ documentIdIdx: index("embeddings_document_id_idx").on(t.documentId) })
);

export const queueJobs = pgTable(
  "queue_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    qstashMessageId: text("qstash_message_id").unique(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").default(0).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("queue_jobs_status_idx").on(t.status),
    typeIdx: index("queue_jobs_type_idx").on(t.type),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;
export type QueueJob = typeof queueJobs.$inferSelect;
export type NewQueueJob = typeof queueJobs.$inferInsert;

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    text: text("text").notNull(),
    type: text("type").default("essay").notNull(), // short_answer, essay, multiple_choice, code
    gradingCriteria: jsonb("grading_criteria"),
    sampleAnswer: text("sample_answer"),
    difficulty: text("difficulty").default("medium").notNull(), // easy, medium, hard
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ topicIdIdx: index("questions_topic_id_idx").on(t.topicId) })
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    userAnswer: text("user_answer").notNull(),
    score: integer("score"),
    feedback: jsonb("feedback"),
    status: text("status").default("pending").notNull(), // pending, marked, failed
    markedAt: timestamp("marked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index("submissions_user_id_idx").on(t.userId),
    questionIdIdx: index("submissions_question_id_idx").on(t.questionId),
  })
);

export const teamsSyncConfigs = pgTable(
  "teams_sync_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cookies: jsonb("cookies").notNull(), // Array of Playwright cookies
    status: text("status").default("active").notNull(), // active, expired, failed
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ userIdIdx: index("teams_sync_configs_user_id_idx").on(t.userId) })
);

export const teamsChannels = pgTable(
  "teams_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    configId: uuid("config_id")
      .notNull()
      .references(() => teamsSyncConfigs.id, { onDelete: "cascade" }),
    teamsChannelId: text("teams_channel_id").notNull(), // Teams internal ID
    channelName: text("channel_name").notNull(),
    teamName: text("team_name"),
    isSynced: boolean("is_synced").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ configIdIdx: index("teams_channels_config_id_idx").on(t.configId) })
);

export const teamsMessages = pgTable(
  "teams_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => teamsChannels.id, { onDelete: "cascade" }),
    teamsMessageId: text("teams_message_id").notNull(),
    sender: text("sender").notNull(),
    content: text("content").notNull(),
    attachments: jsonb("attachments"), // list of parsed attachments
    postedAt: timestamp("posted_at", { withTimezone: true }),
    isProcessed: boolean("is_processed").default(false).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ channelIdIdx: index("teams_messages_channel_id_idx").on(t.channelId) })
);

export const sourceDocuments = pgTable(
  "source_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamsMessageId: text("teams_message_id").notNull(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => teamsChannels.id, { onDelete: "cascade" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    sender: text("sender").notNull(),
    markdown: text("markdown").notNull(),
    rawPlainText: text("raw_plain_text").notNull(),
    attachments: jsonb("attachments"),
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    isProcessed: boolean("is_processed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    channelIdIdx: index("source_documents_channel_id_idx").on(t.channelId),
    teamsMessageIdIdx: index("source_documents_teams_message_id_idx").on(t.teamsMessageId),
    lessonIdIdx: index("source_documents_lesson_id_idx").on(t.lessonId),
    isProcessedIdx: index("source_documents_is_processed_idx").on(t.isProcessed),
  })
);

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  subject: text("subject").default("Computer Science").notNull(),
  teacherName: text("teacher_name").default("Dr. Elizabeth Vance").notNull(),
  attachments: jsonb("attachments"), // list of parsed attachments
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  
  // Asynchronous AI creation additions:
  date: timestamp("date", { withTimezone: true }).defaultNow(),
  rawContext: text("raw_context"),
  structuredContent: jsonb("structured_content"),
  status: text("status").default("placeholder").notNull(), // 'processing' | 'failed' | 'placeholder' | 'published'

  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({
  userIdIdx: index("lessons_user_id_idx").on(table.userId),
}));

export const scrapedTeamsData = pgTable(
  "scraped_teams_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    channelId: text("channel_id").notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).defaultNow().notNull(),
    processed: boolean("processed").default(false).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    processedIdx: index("scraped_teams_data_processed_idx").on(t.processed),
    userIdIdx: index("scraped_teams_data_user_id_idx").on(t.userId),
  })
);

export const aiSemanticCache = pgTable(
  "ai_semantic_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promptText: text("prompt_text").notNull(),
    embedding: vector("embedding", 384).notNull(),
    responseJson: jsonb("response_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export const userErrorMemory = pgTable(
  "user_error_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    concept: text("concept").notNull(),
    errorContext: text("error_context").notNull(),
    embedding: vector("embedding", 384),
    masteryScore: integer("mastery_score").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export const lessonRecallNodes = pgTable(
  "lesson_recall_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    nodeType: text("node_type").notNull(), // 'core_concept' | 'syntax_rule' | 'prerequisite' | 'common_pitfall'
    key: text("key").notNull(),
    summary: text("summary").notNull(),
    /**
     * JSON metadata block. Supports:
     * - codeSnippet?: string
     * - referenceUrl?: string
     * - contextNotes?: string
     * - language?: string
     * - codeBlocks?: { code: string; correctOrder: number }[]
     */
    metadata: jsonb("metadata"),
    embedding: vector("embedding", 768),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    lessonIdIdx: index("lesson_recall_nodes_lesson_id_idx").on(t.lessonId),
  })
);

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type TeamsSyncConfig = typeof teamsSyncConfigs.$inferSelect;
export type NewTeamsSyncConfig = typeof teamsSyncConfigs.$inferInsert;
export type TeamsChannel = typeof teamsChannels.$inferSelect;
export type NewTeamsChannel = typeof teamsChannels.$inferInsert;
export type TeamsMessage = typeof teamsMessages.$inferSelect;
export type NewTeamsMessage = typeof teamsMessages.$inferInsert;
export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type NewSourceDocument = typeof sourceDocuments.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type ScrapedTeamsData = typeof scrapedTeamsData.$inferSelect;
export type NewScrapedTeamsData = typeof scrapedTeamsData.$inferInsert;
export type AISemanticCache = typeof aiSemanticCache.$inferSelect;
export type NewAISemanticCache = typeof aiSemanticCache.$inferInsert;
export type UserErrorMemory = typeof userErrorMemory.$inferSelect;
export type NewUserErrorMemory = typeof userErrorMemory.$inferInsert;
export type LessonRecallNode = typeof lessonRecallNodes.$inferSelect;
export type NewLessonRecallNode = typeof lessonRecallNodes.$inferInsert;

export const lessonChallenges = pgTable(
  "lesson_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    language: text("language").notNull(), // 'python' | 'javascript'
    starterCode: text("starter_code").notNull(),
    testSuite: jsonb("test_suite").notNull(), // Array of { input: string, expectedOutput: string, hiddenAssertionScript?: string }
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    lessonIdIdx: index("lesson_challenges_lesson_id_idx").on(t.lessonId),
    userIdIdx: index("lesson_challenges_user_id_idx").on(t.userId),
  })
);

export type LessonChallenge = typeof lessonChallenges.$inferSelect;
export type NewLessonChallenge = typeof lessonChallenges.$inferInsert;

export const lessonChallengeSubmissions = pgTable(
  "lesson_challenge_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => lessonChallenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userCode: text("user_code").notNull(),
    status: text("status").notNull(), // 'passed' | 'failed'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    challengeUserIdx: index("lesson_challenge_submissions_challenge_user_idx").on(t.challengeId, t.userId),
  })
);

export type LessonChallengeSubmission = typeof lessonChallengeSubmissions.$inferSelect;
export type NewLessonChallengeSubmission = typeof lessonChallengeSubmissions.$inferInsert;

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    deviceLabel: text("device_label"),
    deviceFingerprint: text("device_fingerprint"),
    userDeviceId: uuid("user_device_id").references(() => userDevices.id, {
      onDelete: "set null",
    }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
    userDeviceIdIdx: index("sessions_user_device_id_idx").on(table.userDeviceId),
  })
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("accounts_user_id_idx").on(table.userId),
  })
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    identifierIdx: index("verifications_identifier_idx").on(table.identifier),
  })
);

export type UserDevice = typeof userDevices.$inferSelect;
export type NewUserDevice = typeof userDevices.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;


