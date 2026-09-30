use serde::Serialize;
use sqlx::PgPool;

pub struct AuditEntry<'a> {
    pub user_id: Option<i32>,
    pub user_name: &'a str,
    pub user_role: &'a str,
    pub action: &'a str,
    pub resource: Option<&'a str>,
    pub result: &'a str,
}

pub async fn record_audit(pool: &PgPool, entry: AuditEntry<'_>) -> sqlx::Result<()> {
    sqlx::query!(
        r#"
        insert into audit_logs (user_id, user_name, user_role, action, resource, result)
        values ($1, $2, $3, $4, $5, $6)
        "#,
        entry.user_id,
        entry.user_name,
        entry.user_role,
        entry.action,
        entry.resource,
        entry.result,
    )
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogRow {
    pub id: i32,
    pub user_id: Option<i32>,
    pub user_name: String,
    pub user_role: String,
    pub action: String,
    pub resource: Option<String>,
    pub result: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Default)]
pub struct AuditLogFilters {
    pub action: Option<String>,
    pub result: Option<String>,
    pub limit: Option<i64>,
}

pub async fn list_audit_logs(pool: &PgPool, filters: AuditLogFilters) -> sqlx::Result<Vec<AuditLogRow>> {
    sqlx::query_as!(
        AuditLogRow,
        r#"
        select id, user_id, user_name, user_role, action, resource, result, created_at
        from audit_logs
        where ($1::text is null or action = $1) and ($2::text is null or result = $2)
        order by created_at desc
        limit $3
        "#,
        filters.action,
        filters.result,
        filters.limit.unwrap_or(200)
    )
    .fetch_all(pool)
    .await
}
