use axum::extract::{Path, Query, State};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::Session;
use crate::config::{is_permission_key, DEFAULT_LEGACY_ROLE_MAP, PERMISSIONS};
use crate::error::{AppError, AppResult};
use crate::rbac::audit::{list_audit_logs, AuditLogFilters};
use crate::rbac::{authorize, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/rbac/roles", get(list_roles).post(create_role))
        .route("/api/admin/rbac/roles/:id", axum::routing::patch(update_role).delete(delete_role))
        .route("/api/admin/rbac/roles/:id/permissions", put(set_role_permissions))
        .route("/api/admin/rbac/roles/:id/duplicate", post(duplicate_role))
        .route("/api/admin/rbac/users", get(list_users).post(assign_user_role))
        .route("/api/admin/rbac/user-roles/:id", axum::routing::delete(remove_user_role))
        .route("/api/admin/rbac/legacy-mapping", get(legacy_mapping).post(upsert_legacy_mapping))
        .route("/api/admin/rbac/permissions", get(permission_catalog))
        .route("/api/admin/audit-log", get(audit_log))
}

fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut last_was_sep = true;
    for c in input.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
            last_was_sep = false;
        } else if !last_was_sep {
            out.push('_');
            last_was_sep = true;
        }
    }
    out.trim_matches('_').to_string()
}

async fn list_roles(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "role.manage", None, AuthorizeOptions::default()).await?;

    let roles = sqlx::query!("select * from roles order by category, name").fetch_all(&state.pool).await?;
    let perms = sqlx::query!("select role_id, permission_key from role_permissions").fetch_all(&state.pool).await?;

    let out: Vec<_> = roles
        .into_iter()
        .map(|r| {
            let mut permissions: Vec<&str> = perms.iter().filter(|p| p.role_id == r.id).map(|p| p.permission_key.as_str()).collect();
            permissions.sort();
            json!({
                "id": r.id, "key": r.key, "name": r.name, "description": r.description, "category": r.category,
                "isSystem": r.is_system, "permissions": permissions,
            })
        })
        .collect();

    Ok(Json(json!({ "roles": out })))
}

#[derive(Debug, Deserialize)]
struct CreateRoleBody {
    key: String,
    name: String,
    description: Option<String>,
    category: String,
    permissions: Vec<String>,
}

async fn create_role(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<CreateRoleBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "role.manage",
        None,
        AuthorizeOptions { resource_label: Some(&format!("role:{}", body.key)), force_audit: true },
    )
    .await?;

    let key = slugify(&body.key);
    if key.is_empty() {
        return Err(AppError::BadRequest("Role key is required.".to_string()));
    }
    if sqlx::query!("select id from roles where key = $1", key).fetch_optional(&state.pool).await?.is_some() {
        return Err(AppError::BadRequest(format!("Role \"{key}\" already exists.")));
    }

    let role = sqlx::query!(
        "insert into roles (key, name, description, category, is_system) values ($1, $2, $3, $4, false) returning *",
        key,
        body.name,
        body.description,
        body.category
    )
    .fetch_one(&state.pool)
    .await?;

    let valid: Vec<&String> = body.permissions.iter().filter(|p| is_permission_key(p)).collect();
    for perm in &valid {
        sqlx::query!("insert into role_permissions (role_id, permission_key) values ($1, $2)", role.id, perm.as_str())
            .execute(&state.pool)
            .await?;
    }

    Ok(Json(json!({ "role": {
        "id": role.id, "key": role.key, "name": role.name, "description": role.description,
        "category": role.category, "isSystem": role.is_system,
    } })))
}

#[derive(Debug, Deserialize)]
struct UpdateRoleBody {
    name: Option<String>,
    description: Option<String>,
    category: Option<String>,
}

async fn update_role(State(state): State<AppState>, Session(ctx): Session, Path(id): Path<i32>, Json(body): Json<UpdateRoleBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "role.manage", None, AuthorizeOptions { resource_label: None, force_audit: true }).await?;

    let role = sqlx::query!(
        r#"update roles set
            name = coalesce($1, name),
            description = coalesce($2, description),
            category = coalesce($3, category),
            updated_at = now()
           where id = $4 returning *"#,
        body.name,
        body.description,
        body.category,
        id
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({ "role": {
        "id": role.id, "key": role.key, "name": role.name, "description": role.description, "category": role.category, "isSystem": role.is_system,
    } })))
}

async fn delete_role(State(state): State<AppState>, Session(ctx): Session, Path(id): Path<i32>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "role.manage",
        None,
        AuthorizeOptions { resource_label: Some(&format!("role:{id}")), force_audit: true },
    )
    .await?;

    let role = sqlx::query!("select is_system from roles where id = $1", id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Role not found.".to_string()))?;
    if role.is_system {
        return Err(AppError::BadRequest("System roles can't be deleted - duplicate it to customize instead.".to_string()));
    }

    sqlx::query!("delete from user_roles where role_id = $1", id).execute(&state.pool).await?;
    sqlx::query!("delete from role_permissions where role_id = $1", id).execute(&state.pool).await?;
    sqlx::query!("delete from roles where id = $1", id).execute(&state.pool).await?;

    Ok(Json(json!({ "success": true })))
}

#[derive(Debug, Deserialize)]
struct SetPermissionsBody {
    permissions: Vec<String>,
}

async fn set_role_permissions(State(state): State<AppState>, Session(ctx): Session, Path(id): Path<i32>, Json(body): Json<SetPermissionsBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "permission.manage",
        None,
        AuthorizeOptions { resource_label: Some(&format!("role:{id}")), force_audit: true },
    )
    .await?;

    let valid: Vec<&String> = body.permissions.iter().filter(|p| is_permission_key(p)).collect();
    sqlx::query!("delete from role_permissions where role_id = $1", id).execute(&state.pool).await?;
    for perm in &valid {
        sqlx::query!("insert into role_permissions (role_id, permission_key) values ($1, $2)", id, perm.as_str())
            .execute(&state.pool)
            .await?;
    }

    Ok(Json(json!({ "count": valid.len() })))
}

#[derive(Debug, Deserialize)]
struct DuplicateBody {
    name: Option<String>,
}

async fn duplicate_role(State(state): State<AppState>, Session(ctx): Session, Path(id): Path<i32>, Json(body): Json<DuplicateBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "role.manage", None, AuthorizeOptions { resource_label: None, force_audit: true }).await?;

    let source = sqlx::query!("select * from roles where id = $1", id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Role not found.".to_string()))?;
    let perms = sqlx::query!("select permission_key from role_permissions where role_id = $1", id).fetch_all(&state.pool).await?;

    let new_key = format!("{}_copy_{:x}", source.key, chrono::Utc::now().timestamp_millis());
    let role = sqlx::query!(
        "insert into roles (key, name, description, category, is_system) values ($1, $2, $3, $4, false) returning *",
        new_key,
        body.name.unwrap_or_else(|| "Copy of role".to_string()),
        source.description,
        source.category
    )
    .fetch_one(&state.pool)
    .await?;

    for p in &perms {
        sqlx::query!("insert into role_permissions (role_id, permission_key) values ($1, $2)", role.id, p.permission_key)
            .execute(&state.pool)
            .await?;
    }

    Ok(Json(json!({ "role": {
        "id": role.id, "key": role.key, "name": role.name, "description": role.description, "category": role.category, "isSystem": role.is_system,
    } })))
}

async fn list_users(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "user.manage", None, AuthorizeOptions::default()).await?;

    let users = sqlx::query!("select * from users order by name").fetch_all(&state.pool).await?;
    let assignments = sqlx::query!(
        r#"select ur.id, ur.user_id, ur.role_id, ur.scope, r.name as role_name, r.key as role_key
           from user_roles ur join roles r on r.id = ur.role_id"#
    )
    .fetch_all(&state.pool)
    .await?;
    let departments = sqlx::query!("select * from departments").fetch_all(&state.pool).await?;

    let users_out: Vec<_> = users
        .into_iter()
        .map(|u| {
            let user_assignments: Vec<_> = assignments
                .iter()
                .filter(|a| a.user_id == u.id)
                .map(|a| json!({ "id": a.id, "userId": a.user_id, "roleId": a.role_id, "scope": a.scope, "roleName": a.role_name, "roleKey": a.role_key }))
                .collect();
            json!({
                "id": u.id, "name": u.name, "email": u.email, "role": u.role, "studentId": u.student_id, "facultyId": u.faculty_id,
                "parentId": u.parent_id, "employeeId": u.employee_id, "assignments": user_assignments,
            })
        })
        .collect();
    let departments_out: Vec<_> = departments.into_iter().map(|d| json!({ "id": d.id, "name": d.name, "code": d.code })).collect();

    Ok(Json(json!({ "users": users_out, "departments": departments_out })))
}

#[derive(Debug, Deserialize)]
struct AssignBody {
    #[serde(rename = "userId")]
    user_id: i32,
    #[serde(rename = "roleId")]
    role_id: i32,
    scope: Option<serde_json::Value>,
}

async fn assign_user_role(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<AssignBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "user.manage",
        None,
        AuthorizeOptions { resource_label: Some(&format!("user:{}", body.user_id)), force_audit: true },
    )
    .await?;

    let scope_text = body.scope.as_ref().filter(|v| !v.is_null()).map(|v| v.to_string());
    let row = sqlx::query!(
        "insert into user_roles (user_id, role_id, scope) values ($1, $2, $3) returning *",
        body.user_id,
        body.role_id,
        scope_text
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({ "assignment": { "id": row.id, "userId": row.user_id, "roleId": row.role_id, "scope": row.scope } })))
}

async fn remove_user_role(State(state): State<AppState>, Session(ctx): Session, Path(id): Path<i32>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "user.manage",
        None,
        AuthorizeOptions { resource_label: Some(&format!("user_role:{id}")), force_audit: true },
    )
    .await?;
    sqlx::query!("delete from user_roles where id = $1", id).execute(&state.pool).await?;
    Ok(Json(json!({ "success": true })))
}

async fn legacy_mapping(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "role.manage", None, AuthorizeOptions::default()).await?;
    let rows = sqlx::query!("select * from legacy_role_mappings order by legacy_role").fetch_all(&state.pool).await?;

    let mappings: Vec<_> = if rows.is_empty() {
        DEFAULT_LEGACY_ROLE_MAP
            .iter()
            .enumerate()
            .map(|(i, m)| json!({ "id": -1 - i as i32, "legacyRole": m.legacy_role, "mappedRoleKey": m.mapped_role_key, "notes": m.notes }))
            .collect()
    } else {
        rows.into_iter().map(|r| json!({ "id": r.id, "legacyRole": r.legacy_role, "mappedRoleKey": r.mapped_role_key, "notes": r.notes })).collect()
    };

    Ok(Json(json!({ "mappings": mappings })))
}

#[derive(Debug, Deserialize)]
struct LegacyMappingBody {
    #[serde(rename = "legacyRole")]
    legacy_role: String,
    #[serde(rename = "mappedRoleKey")]
    mapped_role_key: String,
    notes: Option<String>,
}

async fn upsert_legacy_mapping(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<LegacyMappingBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "role.manage", None, AuthorizeOptions { resource_label: None, force_audit: true }).await?;

    let existing = sqlx::query!("select id from legacy_role_mappings where legacy_role = $1", body.legacy_role).fetch_optional(&state.pool).await?;
    let mapping = if let Some(existing) = existing {
        let row = sqlx::query!(
            "update legacy_role_mappings set mapped_role_key = $1, notes = $2 where id = $3 returning id, legacy_role, mapped_role_key, notes",
            body.mapped_role_key,
            body.notes,
            existing.id
        )
        .fetch_one(&state.pool)
        .await?;
        json!({ "id": row.id, "legacyRole": row.legacy_role, "mappedRoleKey": row.mapped_role_key, "notes": row.notes })
    } else {
        let row = sqlx::query!(
            "insert into legacy_role_mappings (legacy_role, mapped_role_key, notes) values ($1, $2, $3) returning id, legacy_role, mapped_role_key, notes",
            body.legacy_role,
            body.mapped_role_key,
            body.notes
        )
        .fetch_one(&state.pool)
        .await?;
        json!({ "id": row.id, "legacyRole": row.legacy_role, "mappedRoleKey": row.mapped_role_key, "notes": row.notes })
    };

    Ok(Json(json!({ "mapping": mapping })))
}

async fn permission_catalog(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "role.manage", None, AuthorizeOptions::default()).await?;
    let permissions: Vec<_> = PERMISSIONS
        .iter()
        .map(|p| json!({ "key": p.key, "label": p.label, "description": p.description, "group": p.group, "sensitive": p.sensitive }))
        .collect();
    Ok(Json(json!({ "permissions": permissions })))
}

#[derive(Debug, Deserialize)]
struct AuditQuery {
    action: Option<String>,
    result: Option<String>,
    limit: Option<i64>,
}

async fn audit_log(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<AuditQuery>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "audit.view", None, AuthorizeOptions::default()).await?;
    let logs = list_audit_logs(&state.pool, AuditLogFilters { action: q.action, result: q.result, limit: q.limit }).await?;
    Ok(Json(json!({ "logs": logs })))
}
