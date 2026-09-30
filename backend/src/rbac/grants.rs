use sqlx::PgPool;

use super::types::{parse_scope, Grant, RoleLabel};

pub async fn load_grants_for_user(pool: &PgPool, user_id: i32) -> sqlx::Result<Vec<Grant>> {
    let rows = sqlx::query!(
        r#"
        select rp.permission_key, ur.scope
        from user_roles ur
        join roles r on r.id = ur.role_id
        join role_permissions rp on rp.role_id = r.id
        where ur.user_id = $1
        "#,
        user_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| Grant { permission: r.permission_key, scope: parse_scope(r.scope.as_deref()) })
        .collect())
}

pub async fn load_role_labels_for_user(pool: &PgPool, user_id: i32) -> sqlx::Result<Vec<RoleLabel>> {
    let rows = sqlx::query!(
        r#"
        select distinct r.key, r.name
        from user_roles ur
        join roles r on r.id = ur.role_id
        where ur.user_id = $1
        "#,
        user_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| RoleLabel { key: r.key, name: r.name }).collect())
}
