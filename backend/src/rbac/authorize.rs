use sqlx::PgPool;
use std::collections::HashSet;

use crate::error::AppError;

use super::audit::{record_audit, AuditEntry};
use super::scope::scope_allows;
use super::types::{AccessContext, ResourceNeed, Scope};

pub async fn parents_child_id(pool: &PgPool, ctx: &AccessContext) -> sqlx::Result<Option<i32>> {
    let Some(parent_id) = ctx.parent_id else { return Ok(None) };
    let row = sqlx::query!("select student_id from parents where id = $1", parent_id)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|r| r.student_id))
}

pub async fn resolve_own_student_id(pool: &PgPool, ctx: &AccessContext) -> sqlx::Result<Option<i32>> {
    if let Some(id) = ctx.student_id {
        return Ok(Some(id));
    }
    parents_child_id(pool, ctx).await
}

async fn faculty_course_ids(pool: &PgPool, ctx: &AccessContext) -> sqlx::Result<Vec<i32>> {
    let Some(faculty_id) = ctx.faculty_id else { return Ok(vec![]) };
    let rows = sqlx::query!("select course_id from sections where faculty_id = $1", faculty_id)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(|r| r.course_id).collect())
}

async fn faculty_roster_student_ids(pool: &PgPool, ctx: &AccessContext) -> sqlx::Result<Vec<i32>> {
    if ctx.faculty_id.is_none() {
        return Ok(vec![]);
    }
    let course_ids = faculty_course_ids(pool, ctx).await?;
    if course_ids.is_empty() {
        return Ok(vec![]);
    }
    let my_courses = sqlx::query!(
        "select programme_id, semester from courses where id = any($1)",
        &course_ids
    )
    .fetch_all(pool)
    .await?;
    let pairs: HashSet<(i32, i32)> = my_courses.into_iter().map(|c| (c.programme_id, c.semester)).collect();
    if pairs.is_empty() {
        return Ok(vec![]);
    }

    let students = sqlx::query!("select id, programme_id, current_semester from students").fetch_all(pool).await?;
    Ok(students
        .into_iter()
        .filter(|s| pairs.contains(&(s.programme_id, s.current_semester)))
        .map(|s| s.id)
        .collect())
}

async fn resolve_dynamic_scope(pool: &PgPool, ctx: &AccessContext, need: &ResourceNeed) -> sqlx::Result<Scope> {
    let mut scope = Scope::default();

    if need.student_id.is_some() {
        if let Some(id) = ctx.student_id {
            scope.student_id = Some(id);
            return Ok(scope);
        }
        if let Some(child_id) = parents_child_id(pool, ctx).await? {
            scope.student_id = Some(child_id);
            return Ok(scope);
        }
        if ctx.faculty_id.is_some() {
            scope.student_ids = Some(faculty_roster_student_ids(pool, ctx).await?);
            return Ok(scope);
        }
    }
    if need.course_id.is_some() && ctx.faculty_id.is_some() {
        scope.course_ids = Some(faculty_course_ids(pool, ctx).await?);
        return Ok(scope);
    }
    if need.department_id.is_some() {
        if let Some(department_id) = ctx.department_id {
            scope.department_id = Some(department_id);
        }
    }
    Ok(scope)
}

/// Read-only check - never throws, never audits. Use for UI hints only.
pub async fn can(pool: &PgPool, ctx: &AccessContext, permission: &str, need: Option<&ResourceNeed>) -> sqlx::Result<bool> {
    let grants: Vec<_> = ctx.grants.iter().filter(|g| g.permission == permission).collect();
    if grants.is_empty() {
        return Ok(false);
    }
    let Some(need) = need else { return Ok(true) };

    for grant in grants {
        let resolved;
        let scope = match &grant.scope {
            Some(s) => s,
            None => {
                resolved = resolve_dynamic_scope(pool, ctx, need).await?;
                &resolved
            }
        };
        if scope_allows(Some(scope), Some(need)) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn describe_need(need: Option<&ResourceNeed>) -> Option<String> {
    let need = need?;
    if let Some(id) = need.student_id {
        return Some(format!("student:{id}"));
    }
    if let Some(id) = need.course_id {
        return Some(format!("course:{id}"));
    }
    if let Some(id) = need.department_id {
        return Some(format!("department:{id}"));
    }
    if let Some(id) = need.employee_id {
        return Some(format!("employee:{id}"));
    }
    None
}

#[derive(Default)]
pub struct AuthorizeOptions<'a> {
    pub resource_label: Option<&'a str>,
    pub force_audit: bool,
}

/// The single authorization entrypoint. Every denial is audited; a success
/// is audited only when the permission is catalogued as sensitive or the
/// caller forces it.
pub async fn authorize(
    pool: &PgPool,
    ctx: &AccessContext,
    permission: &str,
    need: Option<&ResourceNeed>,
    opts: AuthorizeOptions<'_>,
) -> Result<(), AppError> {
    let allowed = can(pool, ctx, permission, need).await?;
    let sensitive = crate::config::is_sensitive(permission);
    if !allowed || opts.force_audit || sensitive {
        let described = describe_need(need);
        record_audit(
            pool,
            AuditEntry {
                user_id: Some(ctx.user_id),
                user_name: &ctx.name,
                user_role: &ctx.role,
                action: permission,
                resource: opts.resource_label.or(described.as_deref()),
                result: if allowed { "success" } else { "denied" },
            },
        )
        .await?;
    }
    if !allowed {
        return Err(AppError::denied());
    }
    Ok(())
}

pub async fn resolve_student_id_for_access(
    pool: &PgPool,
    ctx: &AccessContext,
    permission: &str,
    requested_student_id: Option<i32>,
) -> Result<i32, AppError> {
    let target_id = match requested_student_id {
        Some(id) => Some(id),
        None => resolve_own_student_id(pool, ctx).await?,
    };
    let Some(target_id) = target_id else {
        return Err(AppError::AccessDenied("A student id is required for this role.".to_string()));
    };
    authorize(pool, ctx, permission, Some(&ResourceNeed::student(target_id)), AuthorizeOptions::default()).await?;
    Ok(target_id)
}
