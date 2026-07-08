import Database from 'better-sqlite3';
import path from 'path';
import { seedMarketingAvatars } from '@/lib/seed/marketing-avatars';

const DB_PATH = path.join(process.cwd(), 'data', 'commandpost.db');

let _db: Database.Database | null = null;

export function initDb(dbPath: string = DB_PATH): Database.Database {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -64000');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      notes TEXT,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','completed')),
      monthly_value REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','on-hold','completed')),
      start_date TEXT,
      server_ip TEXT,
      repo_url TEXT,
      deploy_command TEXT,
      stack_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deliverables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','delivered')),
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      source TEXT NOT NULL DEFAULT 'other' CHECK(source IN ('referral','website','outbound','other')),
      estimated_value REAL,
      stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','discovery','proposal','negotiating','won','lost')),
      lost_reason TEXT CHECK(lost_reason IN ('too_expensive','competitor','timing','ghosted','other')),
      follow_up_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      converted_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS lead_stage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      entered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lead_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','paid')),
      due_date TEXT NOT NULL,
      sent_at TEXT,
      paid_at TEXT,
      stripe_payment_link TEXT,
      stripe_payment_id TEXT,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_day INTEGER,
      total_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('servers','software','contractor','marketing','other')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      check_interval_seconds INTEGER NOT NULL DEFAULT 300,
      slow_threshold_ms INTEGER NOT NULL DEFAULT 5000,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS health_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
      status_code INTEGER,
      response_time_ms INTEGER NOT NULL,
      is_healthy INTEGER NOT NULL,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      duration_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS alerts_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      reference_id INTEGER,
      message TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS disk_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
      mount_point TEXT NOT NULL,
      total_gb REAL NOT NULL,
      used_gb REAL NOT NULL,
      percent_used REAL NOT NULL,
      reported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      deliverable_id INTEGER REFERENCES deliverables(id) ON DELETE SET NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      hourly_rate REAL NOT NULL,
      is_invoiced INTEGER NOT NULL DEFAULT 0,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_type TEXT NOT NULL UNIQUE,
      email_delivery TEXT NOT NULL DEFAULT 'digest' CHECK(email_delivery IN ('immediate','digest','none'))
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      scope TEXT,
      timeline TEXT,
      valid_until TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired')),
      token TEXT UNIQUE,
      accepted_at TEXT,
      accepted_ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proposal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      terms_summary TEXT,
      signed_at TEXT NOT NULL,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','renewed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      stack_notes TEXT,
      hourly_rate REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS template_deliverables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      days_offset INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration: add hourly_rate to projects
  const hasHourlyRate = db.prepare("SELECT COUNT(*) as count FROM pragma_table_info('projects') WHERE name = 'hourly_rate'").get() as { count: number };
  if (hasHourlyRate.count === 0) {
    db.exec("ALTER TABLE projects ADD COLUMN hourly_rate REAL");
  }

  // Migration: add portal_token to clients
  const hasPortalToken = db.prepare("SELECT COUNT(*) as count FROM pragma_table_info('clients') WHERE name = 'portal_token'").get() as { count: number };
  if (hasPortalToken.count === 0) {
    db.exec("ALTER TABLE clients ADD COLUMN portal_token TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_portal_token ON clients(portal_token) WHERE portal_token IS NOT NULL");
  }

  // Migration: create audit_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create goals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      target_value REAL NOT NULL,
      current_value REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'revenue',
      period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('weekly','monthly','quarterly','yearly')),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create meetings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      meeting_date TEXT NOT NULL,
      duration_minutes INTEGER,
      notes TEXT,
      action_items TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create recurring_tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'weekly' CHECK(frequency IN ('daily','weekly','monthly')),
      day_of_week INTEGER,
      day_of_month INTEGER,
      last_generated_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create tags tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT 'gray'
    );
    CREATE TABLE IF NOT EXISTS client_tags (
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (client_id, tag_id)
    );
  `);

  // Migration: add is_pinned to clients
  const hasPinned = db.prepare("SELECT COUNT(*) as count FROM pragma_table_info('clients') WHERE name = 'is_pinned'").get() as { count: number };
  if (hasPinned.count === 0) {
    db.exec("ALTER TABLE clients ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0");
  }

  // Migration: create client_documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      doc_type TEXT NOT NULL DEFAULT 'note' CHECK(doc_type IN ('note','link','file')),
      content TEXT,
      url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: create scratchpad table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scratchpad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create metric_snapshots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      snapshot_date TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_metric_snapshots_date ON metric_snapshots(snapshot_date, metric_name);
  `);

  // Migration: create onboarding_checklists tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS onboarding_template_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES onboarding_templates(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS onboarding_checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      template_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS onboarding_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL REFERENCES onboarding_checklists(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration: create email_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      email_type TEXT NOT NULL DEFAULT 'other' CHECK(email_type IN ('invoice','reminder','proposal','follow_up','other')),
      reference_id INTEGER,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add last_reminder_sent to invoices
  const hasReminder = db.prepare("SELECT COUNT(*) as count FROM pragma_table_info('invoices') WHERE name = 'last_reminder_sent'").get() as { count: number };
  if (hasReminder.count === 0) {
    db.exec("ALTER TABLE invoices ADD COLUMN last_reminder_sent TEXT");
  }

  // Migration: create milestones table
  db.exec(`
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed')),
      color TEXT NOT NULL DEFAULT 'blue',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create subscriptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'software' CHECK(category IN ('servers','software','contractor','marketing','other')),
      amount REAL NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('monthly','yearly')),
      next_renewal TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create proposal_templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS proposal_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      scope TEXT,
      timeline TEXT,
      valid_days INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS proposal_template_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES proposal_templates(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL
    );
  `);

  // Migration: create satisfaction_scores table
  db.exec(`
    CREATE TABLE IF NOT EXISTS satisfaction_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      score INTEGER NOT NULL CHECK(score >= 0 AND score <= 10),
      notes TEXT,
      scored_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add budget to projects
  const hasBudget = db.prepare("SELECT COUNT(*) as count FROM pragma_table_info('projects') WHERE name = 'budget'").get() as { count: number };
  if (hasBudget.count === 0) {
    db.exec("ALTER TABLE projects ADD COLUMN budget REAL");
  }

  // Migration: create saved_filters table
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      page TEXT NOT NULL,
      params TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create webhooks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_triggered TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create communications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      comm_type TEXT NOT NULL DEFAULT 'note' CHECK(comm_type IN ('call','email','meeting','note')),
      subject TEXT NOT NULL,
      body TEXT,
      comm_date TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create invoice_payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'other',
      notes TEXT,
      paid_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add expense_budgets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expense_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL UNIQUE,
      monthly_limit REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('client','project','invoice','proposal','contract')),
      entity_id INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create automations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_value TEXT,
      action_type TEXT NOT NULL,
      action_config TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create automation_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id INTEGER REFERENCES automations(id),
      trigger_detail TEXT,
      action_detail TEXT,
      ran_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: create posts + post_variants tables (Phase 15 content creation)
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      idea TEXT,
      image_path TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','posted','archived')),
      scheduled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL CHECK(platform IN ('x','linkedin','facebook','instagram')),
      content TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','posted','failed')),
      published_at TEXT,
      platform_post_id TEXT,
      error TEXT,
      UNIQUE(post_id, platform)
    );

    CREATE INDEX IF NOT EXISTS idx_post_variants_post ON post_variants(post_id);
  `);

  // Migration: create media_items + media_clips tables (Video / shorts extraction)
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'podcast' CHECK(media_type IN ('podcast','radio','video','interview','other')),
      source TEXT NOT NULL DEFAULT 'upload' CHECK(source IN ('upload','transcript','local')),
      filename TEXT,
      original_name TEXT,
      mime_type TEXT,
      size INTEGER NOT NULL DEFAULT 0,
      duration_seconds REAL,
      transcript TEXT,
      segments TEXT,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','transcribing','extracting','ready','error')),
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS media_clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      start_seconds REAL NOT NULL DEFAULT 0,
      end_seconds REAL NOT NULL DEFAULT 0,
      transcript_excerpt TEXT,
      reason TEXT,
      clip_filename TEXT,
      status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','cut','discarded')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_media_clips_item ON media_clips(media_item_id);
  `);

  // Migration: create kb_documents table (Ingestion → knowledge base)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'text' CHECK(source_type IN ('website','pdf','html','text','book','system')),
      source_url TEXT,
      content TEXT NOT NULL DEFAULT '',
      char_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_kb_documents_created ON kb_documents(created_at DESC);
  `);

  // Migration: widen kb_documents.source_type CHECK to include 'system'.
  // SQLite can't ALTER a CHECK constraint, so rebuild the table when the
  // existing definition predates 'system' (data + ids preserved).
  const kbDocsSql = (
    db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='kb_documents'").get() as
      | { sql?: string }
      | undefined
  )?.sql ?? '';
  if (kbDocsSql && !kbDocsSql.includes("'system'")) {
    db.pragma('foreign_keys = OFF');
    // legacy_alter_table keeps RENAME from rewriting FK references in other
    // tables (e.g. kb_chunks) to the temp name, which would dangle on DROP.
    db.pragma('legacy_alter_table = ON');
    const rebuildKbDocs = db.transaction(() => {
      db.exec(`
        ALTER TABLE kb_documents RENAME TO kb_documents_old;
        CREATE TABLE kb_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          source_type TEXT NOT NULL DEFAULT 'text' CHECK(source_type IN ('website','pdf','html','text','book','system')),
          source_url TEXT,
          content TEXT NOT NULL DEFAULT '',
          char_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO kb_documents (id, title, source_type, source_url, content, char_count, created_at)
          SELECT id, title, source_type, source_url, content, char_count, created_at FROM kb_documents_old;
        DROP TABLE kb_documents_old;
        CREATE INDEX IF NOT EXISTS idx_kb_documents_created ON kb_documents(created_at DESC);
      `);
    });
    rebuildKbDocs();
    db.pragma('legacy_alter_table = OFF');
    db.pragma('foreign_keys = ON');
  }

  // Migration: kb_chunks (retrieval units; embedding is null until vector RAG is enabled)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kb_document_id INTEGER NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      embedding TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON kb_chunks(kb_document_id);
    CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedded ON kb_chunks(id) WHERE embedding IS NOT NULL;
  `);

  // Migration: generations (Generate page history)
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_type TEXT NOT NULL,
      topic TEXT NOT NULL,
      length TEXT NOT NULL DEFAULT 'medium',
      source_ids TEXT,
      source_count INTEGER NOT NULL DEFAULT 0,
      retrieval_mode TEXT NOT NULL DEFAULT 'none',
      result TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at DESC);
  `);

  // Migration: avatars (target audience personas for Generate)
  db.exec(`
    CREATE TABLE IF NOT EXISTS avatars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      summary TEXT,
      description TEXT,
      tone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: structured vertical-overlay fields on avatars (additive, nullable)
  const addAvatarCol = (col: string, decl: string) => {
    const has = db
      .prepare("SELECT COUNT(*) as count FROM pragma_table_info('avatars') WHERE name = ?")
      .get(col) as { count: number };
    if (has.count === 0) db.exec(`ALTER TABLE avatars ADD COLUMN ${col} ${decl}`);
  };
  addAvatarCol('persona', 'TEXT');
  addAvatarCol('buying_trigger', 'TEXT');
  addAvatarCol('proof_point', 'TEXT');
  addAvatarCol('writing_target', 'TEXT');
  addAvatarCol('what_tried', 'TEXT');
  addAvatarCol('pains', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('desires', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('objections', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('vocabulary', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('trust_triggers', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('channels', "TEXT NOT NULL DEFAULT '[]'");

  // Migration: master_profile singleton (id is always 1)
  db.exec(`
    CREATE TABLE IF NOT EXISTS master_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      identity TEXT,
      wants TEXT,
      burned_by TEXT,
      buying_trigger TEXT,
      tone TEXT,
      objections TEXT NOT NULL DEFAULT '[]',
      trust_builders TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add avatar_id to generations
  const hasAvatarId = db
    .prepare("SELECT COUNT(*) as count FROM pragma_table_info('generations') WHERE name = 'avatar_id'")
    .get() as { count: number };
  if (hasAvatarId.count === 0) {
    db.exec('ALTER TABLE generations ADD COLUMN avatar_id INTEGER');
  }

  // Migration: add buffer_post_id to generations (auto-draft to Buffer)
  const hasGenBufferId = db
    .prepare("SELECT COUNT(*) as count FROM pragma_table_info('generations') WHERE name = 'buffer_post_id'")
    .get() as { count: number };
  if (hasGenBufferId.count === 0) {
    db.exec('ALTER TABLE generations ADD COLUMN buffer_post_id TEXT');
  }

  // Migration: Outreach (Four Lanes) — door attribution on leads + per-week tracker log
  const hasLeadLane = db
    .prepare("SELECT COUNT(*) as count FROM pragma_table_info('leads') WHERE name = 'lane'")
    .get() as { count: number };
  if (hasLeadLane.count === 0) {
    db.exec('ALTER TABLE leads ADD COLUMN lane TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach_week (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      lane TEXT NOT NULL,
      metrics TEXT NOT NULL DEFAULT '{}',
      cadence TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(week_start, lane)
    );
  `);

  // Migration: mailing address + reply tracking on leads (additive, nullable) — for
  // handwritten-letter / email outreach. Owner name reuses contact_person.
  const addLeadCol = (col: string, decl: string) => {
    const has = db
      .prepare("SELECT COUNT(*) as count FROM pragma_table_info('leads') WHERE name = ?")
      .get(col) as { count: number };
    if (has.count === 0) db.exec(`ALTER TABLE leads ADD COLUMN ${col} ${decl}`);
  };
  addLeadCol('street', 'TEXT');
  addLeadCol('city', 'TEXT');
  addLeadCol('state', 'TEXT');
  addLeadCol('postal_code', 'TEXT');
  addLeadCol('socials', 'TEXT');
  addLeadCol('replied_at', 'TEXT');
  // Search/filter fields: industry (segment + category) and parsed employee size.
  addLeadCol('segment', 'TEXT');
  addLeadCol('category', 'TEXT');
  addLeadCol('employee_min', 'INTEGER');
  addLeadCol('employee_max', 'INTEGER');

  // Migration: outreach touches — one row per letter/email/phone send against a lead.
  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach_touches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK(channel IN ('letter','email','phone')),
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_outreach_touches_lead ON outreach_touches(lead_id);
  `);

  // Migration: allow linkedin + fb outreach channels (rebuild CHECK)
  const touchDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='outreach_touches'").get() as { sql: string } | undefined;
  if (touchDef && !touchDef.sql.includes("'linkedin'")) {
    db.pragma('foreign_keys = OFF');
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE outreach_touches_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
          channel TEXT NOT NULL CHECK(channel IN ('letter','email','phone','linkedin','fb')),
          sent_at TEXT NOT NULL DEFAULT (datetime('now')),
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO outreach_touches_new SELECT * FROM outreach_touches;
        DROP TABLE outreach_touches;
        ALTER TABLE outreach_touches_new RENAME TO outreach_touches;
      `);
      db.exec("CREATE INDEX IF NOT EXISTS idx_outreach_touches_lead ON outreach_touches(lead_id);");
    });
    rebuild();
    db.pragma('foreign_keys = ON');
  }

  // Migration: add per-channel outreach draft columns to leads
  for (const col of ['draft_letter', 'draft_email', 'draft_linkedin', 'draft_fb']) {
    const has = db.prepare("SELECT COUNT(*) as count FROM pragma_table_info('leads') WHERE name = ?").get(col) as { count: number };
    if (!has.count) db.exec(`ALTER TABLE leads ADD COLUMN ${col} TEXT`);
  }

  // Migration: outreach email queue — per-lead email pipeline status + suppression.
  // email_sent_at_q is the queue's own send-stamp (distinct from the derived
  // email_sent_at alias that listLeadsByLane builds from outreach_touches).
  {
    const have = new Set(
      (db.prepare("PRAGMA table_info(leads)").all() as { name: string }[]).map((c) => c.name)
    );
    const add: Array<[string, string]> = [
      ['email_status', 'TEXT'],
      ['email_queued_at', 'TEXT'],
      ['email_sent_at_q', 'TEXT'],
      ['email_error', 'TEXT'],
      ['do_not_email', 'INTEGER NOT NULL DEFAULT 0'],
    ];
    for (const [name, decl] of add) {
      if (!have.has(name)) db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${decl}`);
    }
    db.exec(
      "UPDATE leads SET email_status='draft' WHERE email_status IS NULL AND draft_email IS NOT NULL AND trim(draft_email) <> ''"
    );
  }

  // Migration: 5-email drip sequence — enrollment stamp on leads plus a per-step
  // send log. ok=0 rows are failed attempts that block the step until retried.
  {
    const has = db
      .prepare("SELECT COUNT(*) as count FROM pragma_table_info('leads') WHERE name = 'sequence_enrolled_at'")
      .get() as { count: number };
    if (!has.count) db.exec('ALTER TABLE leads ADD COLUMN sequence_enrolled_at TEXT');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sequence_sends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        step INTEGER NOT NULL,
        ok INTEGER NOT NULL DEFAULT 1,
        error TEXT,
        sent_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(lead_id, step, ok)
      );
      CREATE INDEX IF NOT EXISTS idx_sequence_sends_lead ON sequence_sends(lead_id);
    `);
  }

  // Migration: handwritten-letter batch queue — parallels the email queue's
  // per-lead status columns. letter_sent_at_q (not letter_sent_at) because
  // listLeadsByLane already derives a letter_sent_at alias from
  // outreach_touches; same collision email_sent_at_q solved.
  {
    const have = new Set(
      (db.prepare("PRAGMA table_info(leads)").all() as { name: string }[]).map((c) => c.name)
    );
    const add: Array<[string, string]> = [
      ['letter_status', 'TEXT'],
      ['letter_sent_at_q', 'TEXT'],
      ['letter_batch_date', 'TEXT'],
    ];
    for (const [name, decl] of add) {
      if (!have.has(name)) db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${decl}`);
    }
  }

  // Prospect research enrichment: web-searched facts used to personalize drafts.
  {
    const have = new Set(
      (db.prepare("PRAGMA table_info(leads)").all() as { name: string }[]).map((c) => c.name)
    );
    for (const name of ['research_notes', 'researched_at']) {
      if (!have.has(name)) db.exec(`ALTER TABLE leads ADD COLUMN ${name} TEXT`);
    }
  }

  return db;
}

export function getDb(): Database.Database {
  if (!_db) {
    _db = initDb();
    seedMarketingAvatars(_db);
  }
  return _db;
}
