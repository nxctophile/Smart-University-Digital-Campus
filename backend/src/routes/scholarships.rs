use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, resolve_student_id_for_access, AuthorizeOptions};
use crate::routes::risk::student_risk;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/scholarships", get(my_view))
        .route("/api/scholarships/apply", post(apply))
        .route("/api/admin/scholarships/applications", get(applications))
        .route("/api/admin/scholarships/decide", post(decide))
        .route("/api/admin/scholarships/overview", get(admin_overview))
}

async fn my_view(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "scholarship.status.view", None).await?;
    let student = sqlx::query!("select department_id from students where id = $1", student_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Student not found.".to_string()))?;
    let dept_code = sqlx::query!("select code from departments where id = $1", student.department_id).fetch_one(&state.pool).await?.code;

    let attendance = student_risk(&state.pool, student_id).await?.map(|r| r.attendance_percentage).unwrap_or(100.0);

    let all = sqlx::query!("select * from scholarships order by deadline").fetch_all(&state.pool).await?;
    let mine = sqlx::query!(
        "select id, scholarship_id, status, applied_at, decided_at, remarks from scholarship_applications where student_id = $1",
        student_id
    )
    .fetch_all(&state.pool)
    .await?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let applied_ids: std::collections::HashSet<i32> = mine.iter().map(|a| a.scholarship_id).collect();

    let eligible: Vec<_> = all
        .iter()
        .map(|s| {
            let dept_ok = s.department_code.as_deref().map(|c| c == dept_code).unwrap_or(true);
            let attendance_ok = s.min_attendance.map(|m| attendance >= m).unwrap_or(true);
            let deadline_ok = s.deadline >= today;
            json!({
                "id": s.id, "name": s.name, "provider": s.provider, "amount": s.amount, "eligibility": s.eligibility,
                "minAttendance": s.min_attendance, "maxFamilyIncome": s.max_family_income, "departmentCode": s.department_code,
                "deadline": s.deadline, "seatsAvailable": s.seats_available,
                "eligible": dept_ok && attendance_ok && deadline_ok,
                "deadlinePassed": !deadline_ok,
                "alreadyApplied": applied_ids.contains(&s.id),
            })
        })
        .collect();

    let applications: Vec<_> = mine
        .iter()
        .map(|a| {
            let s = all.iter().find(|s| s.id == a.scholarship_id);
            json!({
                "id": a.id, "scholarshipId": a.scholarship_id, "status": a.status, "appliedAt": a.applied_at, "decidedAt": a.decided_at,
                "remarks": a.remarks, "scholarshipName": s.map(|s| &s.name), "amount": s.map(|s| s.amount),
                "statusSteps": ["submitted", "under_review", "approved", "disbursed"], "rejected": a.status == "rejected",
            })
        })
        .collect();

    Ok(Json(json!({ "scholarships": eligible, "applications": applications, "attendance": attendance })))
}

#[derive(Debug, Deserialize)]
struct ApplyBody {
    #[serde(rename = "scholarshipId")]
    scholarship_id: i32,
}

async fn apply(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<ApplyBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "scholarship.apply", None).await?;
    let scholarship = sqlx::query!("select * from scholarships where id = $1", body.scholarship_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Scholarship not found.".to_string()))?;

    let existing = sqlx::query!(
        "select * from scholarship_applications where scholarship_id = $1 and student_id = $2",
        body.scholarship_id,
        student_id
    )
    .fetch_optional(&state.pool)
    .await?;
    if let Some(existing) = existing {
        return Ok(Json(json!({ "success": false, "reason": "already_applied", "application": {
            "id": existing.id, "status": existing.status, "appliedAt": existing.applied_at,
        } })));
    }

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    if scholarship.deadline < today {
        return Ok(Json(json!({ "success": false, "reason": "deadline_passed", "application": null })));
    }

    let attendance = student_risk(&state.pool, student_id).await?.map(|r| r.attendance_percentage).unwrap_or(0.0);
    if let Some(min) = scholarship.min_attendance {
        if attendance < min {
            return Ok(Json(json!({ "success": false, "reason": "not_eligible", "application": null })));
        }
    }

    let application = sqlx::query!(
        r#"insert into scholarship_applications (scholarship_id, student_id, status, applied_at, documents_submitted)
           values ($1, $2, 'submitted', $3, true) returning *"#,
        body.scholarship_id,
        student_id,
        today
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({ "success": true, "reason": null, "application": {
        "id": application.id, "scholarshipId": application.scholarship_id, "studentId": application.student_id,
        "status": application.status, "appliedAt": application.applied_at,
    } })))
}

#[derive(Debug, Deserialize)]
struct ApplicationsQuery {
    status: Option<String>,
}

async fn applications(State(state): State<AppState>, Session(ctx): Session, Query(q): Query<ApplicationsQuery>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "scholarship.application.view", None, AuthorizeOptions::default()).await?;
    let rows = sqlx::query!(
        r#"
        select sa.id, sa.status, sa.applied_at, sa.decided_at, sa.remarks, s.name as scholarship_name, s.amount,
               st.roll_number, st.first_name, st.last_name, d.code as department_code
        from scholarship_applications sa
        join scholarships s on s.id = sa.scholarship_id
        join students st on st.id = sa.student_id
        join departments d on d.id = st.department_id
        where $1::text is null or sa.status = $1
        order by sa.applied_at desc
        limit 100
        "#,
        q.status
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "status": r.status, "appliedAt": r.applied_at, "decidedAt": r.decided_at, "remarks": r.remarks,
            "scholarshipName": r.scholarship_name, "amount": r.amount, "rollNumber": r.roll_number,
            "firstName": r.first_name, "lastName": r.last_name, "departmentCode": r.department_code,
        }))
        .collect();

    Ok(Json(json!({ "applications": out })))
}

#[derive(Debug, Deserialize)]
struct DecideBody {
    #[serde(rename = "applicationId")]
    application_id: i32,
    decision: String,
    remarks: Option<String>,
}

async fn decide(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<DecideBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "scholarship.status.update",
        None,
        AuthorizeOptions { resource_label: Some(&format!("scholarship_application:{}", body.application_id)), force_audit: true },
    )
    .await?;

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let application = sqlx::query!(
        "update scholarship_applications set status = $1, decided_at = $2, remarks = $3 where id = $4 returning *",
        body.decision,
        today,
        body.remarks,
        body.application_id
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({ "application": {
        "id": application.id, "scholarshipId": application.scholarship_id, "studentId": application.student_id,
        "status": application.status, "appliedAt": application.applied_at, "decidedAt": application.decided_at, "remarks": application.remarks,
    } })))
}

async fn admin_overview(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "scholarship.application.view", None, AuthorizeOptions::default()).await?;

    let stats = sqlx::query!(
        r#"select
            count(*) as "total!",
            sum(case when status in ('submitted','under_review') then 1 else 0 end) as pending,
            sum(case when status = 'approved' then 1 else 0 end) as approved,
            sum(case when status = 'rejected' then 1 else 0 end) as rejected,
            sum(case when status = 'disbursed' then 1 else 0 end) as disbursed
           from scholarship_applications"#
    )
    .fetch_one(&state.pool)
    .await?;

    let disbursed_amount = sqlx::query!(
        r#"select coalesce(sum(s.amount), 0) as "total!" from scholarship_applications sa join scholarships s on s.id = sa.scholarship_id where sa.status = 'disbursed'"#
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({
        "total": stats.total, "pending": stats.pending.unwrap_or(0), "approved": stats.approved.unwrap_or(0),
        "rejected": stats.rejected.unwrap_or(0), "disbursed": stats.disbursed.unwrap_or(0), "disbursedAmount": disbursed_amount.total,
    })))
}
