# Manual migration to create workspace tables that are missing from the database.
# All migrations show as applied but the physical tables were never created.
# Uses IF NOT EXISTS to be safe and idempotent.

from django.db import migrations


SQL_CREATE_CHECKLIST_TEMPLATE = """
CREATE TABLE IF NOT EXISTS workspace_checklist_template (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    trigger VARCHAR(30) NOT NULL DEFAULT 'CUSTOM',
    assign_to_role_id BIGINT REFERENCES "role"(id) ON DELETE SET NULL,
    points INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NULL
);
"""

SQL_CREATE_CHECKLIST_TEMPLATE_ITEM = """
CREATE TABLE IF NOT EXISTS workspace_checklist_template_item (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    template_id BIGINT NOT NULL REFERENCES workspace_checklist_template(id) ON DELETE CASCADE,
    label VARCHAR(300) NOT NULL,
    description TEXT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS workspace_cti_template_idx ON workspace_checklist_template_item (template_id);
CREATE INDEX IF NOT EXISTS workspace_cti_order_idx ON workspace_checklist_template_item (template_id, "order");
"""

SQL_CREATE_CHECKLIST_INSTANCE = """
CREATE TABLE IF NOT EXISTS workspace_checklist_instance (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    template_id BIGINT NOT NULL REFERENCES workspace_checklist_template(id) ON DELETE CASCADE,
    assigned_to_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    completed_at TIMESTAMPTZ NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS workspace_ci_assigned_idx ON workspace_checklist_instance (assigned_to_id);
CREATE INDEX IF NOT EXISTS workspace_ci_date_idx ON workspace_checklist_instance (date);
"""

SQL_CREATE_CHECKLIST_ITEM_RESPONSE = """
CREATE TABLE IF NOT EXISTS workspace_checklist_item_response (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    instance_id BIGINT NOT NULL REFERENCES workspace_checklist_instance(id) ON DELETE CASCADE,
    template_item_id BIGINT NOT NULL REFERENCES workspace_checklist_template_item(id) ON DELETE CASCADE,
    is_checked BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NULL,
    checked_at TIMESTAMPTZ NULL,
    UNIQUE (instance_id, template_item_id)
);
"""

SQL_CREATE_QUESTIONNAIRE = """
CREATE TABLE IF NOT EXISTS workspace_questionnaire (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    frequency VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NULL,
    assign_to_role_id BIGINT REFERENCES "role"(id) ON DELETE SET NULL
);
"""

SQL_CREATE_QUESTIONNAIRE_QUESTION = """
CREATE TABLE IF NOT EXISTS workspace_questionnaire_question (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    questionnaire_id BIGINT NOT NULL REFERENCES workspace_questionnaire(id) ON DELETE CASCADE,
    question_text VARCHAR(500) NOT NULL,
    question_type VARCHAR(10) NOT NULL DEFAULT 'RATING',
    choices JSONB NOT NULL DEFAULT '[]',
    max_score INTEGER NOT NULL DEFAULT 5,
    "order" INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT TRUE
);
"""

SQL_CREATE_QUESTIONNAIRE_RESPONSE = """
CREATE TABLE IF NOT EXISTS workspace_questionnaire_response (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    questionnaire_id BIGINT NOT NULL REFERENCES workspace_questionnaire(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    evaluator_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
    period_label VARCHAR(50) NULL,
    total_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    max_possible_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    score_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ NULL
);
"""

SQL_CREATE_QUESTIONNAIRE_ANSWER = """
CREATE TABLE IF NOT EXISTS workspace_questionnaire_answer (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    response_id BIGINT NOT NULL REFERENCES workspace_questionnaire_response(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES workspace_questionnaire_question(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL DEFAULT 0,
    text_answer TEXT NULL,
    choice_answer VARCHAR(200) NULL,
    UNIQUE (response_id, question_id)
);
"""

SQL_CREATE_EMPLOYEE_PERFORMANCE = """
CREATE TABLE IF NOT EXISTS workspace_employee_performance (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    period_label VARCHAR(50) NOT NULL,
    overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    tier VARCHAR(20) NULL,
    UNIQUE (tenant_id, employee_id, period_label)
);
"""

SQL_CREATE_EMPLOYEE_REQUEST = """
CREATE TABLE IF NOT EXISTS workspace_employee_request (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    requested_by_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
    reviewed_by_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
    resulting_task_id BIGINT REFERENCES workspace_task(id) ON DELETE SET NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT NULL,
    request_type VARCHAR(30) NOT NULL DEFAULT 'SUGGESTION',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NULL,
    reviewed_at TIMESTAMPTZ NULL
);
"""

SQL_CREATE_TASK_ATTACHMENT = """
CREATE TABLE IF NOT EXISTS workspace_task_attachment (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    task_id BIGINT NOT NULL REFERENCES workspace_task(id) ON DELETE CASCADE,
    uploaded_by_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
    file VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NULL
);
"""

SQL_CREATE_TASK_COMMENT = """
CREATE TABLE IF NOT EXISTS workspace_task_comment (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    task_id BIGINT NOT NULL REFERENCES workspace_task(id) ON DELETE CASCADE,
    author_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_response BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NULL
);
"""

SQL_CREATE_TASK_TEMPLATE = """
CREATE TABLE IF NOT EXISTS workspace_task_template (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    assign_to_role_id BIGINT REFERENCES "role"(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    default_priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    default_points INTEGER NOT NULL DEFAULT 1,
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule VARCHAR(20) NULL,
    recurrence_time TIME NULL,
    assign_to_department INTEGER NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NULL
);
"""

SQL_CREATE_WORKSPACE_CONFIG = """
CREATE TABLE IF NOT EXISTS workspace_config (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES organization(id) ON DELETE CASCADE,
    task_statuses JSONB NOT NULL DEFAULT '{}',
    task_priorities JSONB NOT NULL DEFAULT '{}',
    task_completion_weight NUMERIC(5,2) NOT NULL DEFAULT 30,
    on_time_weight NUMERIC(5,2) NOT NULL DEFAULT 25,
    checklist_weight NUMERIC(5,2) NOT NULL DEFAULT 20,
    evaluation_weight NUMERIC(5,2) NOT NULL DEFAULT 25,
    bronze_threshold NUMERIC(5,2) NOT NULL DEFAULT 40,
    silver_threshold NUMERIC(5,2) NOT NULL DEFAULT 60,
    gold_threshold NUMERIC(5,2) NOT NULL DEFAULT 80,
    platinum_threshold NUMERIC(5,2) NOT NULL DEFAULT 90,
    checklist_triggers JSONB NOT NULL DEFAULT '{}',
    request_types JSONB NOT NULL DEFAULT '{}',
    enable_auto_tasks BOOLEAN NOT NULL DEFAULT TRUE,
    enable_checklists BOOLEAN NOT NULL DEFAULT TRUE,
    enable_performance_scoring BOOLEAN NOT NULL DEFAULT TRUE
);
"""


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0006_remove_autotaskrule_organization_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql=SQL_CREATE_CHECKLIST_TEMPLATE,
            reverse_sql='DROP TABLE IF EXISTS workspace_checklist_template CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_CHECKLIST_TEMPLATE_ITEM,
            reverse_sql='DROP TABLE IF EXISTS workspace_checklist_template_item CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_CHECKLIST_INSTANCE,
            reverse_sql='DROP TABLE IF EXISTS workspace_checklist_instance CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_CHECKLIST_ITEM_RESPONSE,
            reverse_sql='DROP TABLE IF EXISTS workspace_checklist_item_response CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_QUESTIONNAIRE,
            reverse_sql='DROP TABLE IF EXISTS workspace_questionnaire CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_QUESTIONNAIRE_QUESTION,
            reverse_sql='DROP TABLE IF EXISTS workspace_questionnaire_question CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_QUESTIONNAIRE_RESPONSE,
            reverse_sql='DROP TABLE IF EXISTS workspace_questionnaire_response CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_QUESTIONNAIRE_ANSWER,
            reverse_sql='DROP TABLE IF EXISTS workspace_questionnaire_answer CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_EMPLOYEE_PERFORMANCE,
            reverse_sql='DROP TABLE IF EXISTS workspace_employee_performance CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_EMPLOYEE_REQUEST,
            reverse_sql='DROP TABLE IF EXISTS workspace_employee_request CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_TASK_ATTACHMENT,
            reverse_sql='DROP TABLE IF EXISTS workspace_task_attachment CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_TASK_COMMENT,
            reverse_sql='DROP TABLE IF EXISTS workspace_task_comment CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_TASK_TEMPLATE,
            reverse_sql='DROP TABLE IF EXISTS workspace_task_template CASCADE;',
        ),
        migrations.RunSQL(
            sql=SQL_CREATE_WORKSPACE_CONFIG,
            reverse_sql='DROP TABLE IF EXISTS workspace_config CASCADE;',
        ),
    ]
