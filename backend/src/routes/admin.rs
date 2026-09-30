use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::{authorize, AuthorizeOptions};
use crate::routes::risk::all_student_risk_profiles;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/admin/overview", get(overview)).route("/api/admin/notify", post(notify))
}

async fn overview(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "report.view", None, AuthorizeOptions::default()).await?;

    let total_students = sqlx::query!(r#"select count(*) as "c!" from students where status = 'active'"#).fetch_one(&state.pool).await?.c;
    let att = sqlx::query!(
        r#"select sum(case when status in ('present','excused') then 1 else 0 end) as present, count(*) as "total!" from attendance"#
    )
    .fetch_one(&state.pool)
    .await?;
    let avg_attendance = if att.total > 0 { (att.present.unwrap_or(0) as f64 / att.total as f64 * 1000.0).round() / 10.0 } else { 0.0 };

    let fee_pending = sqlx::query!(r#"select coalesce(sum(amount - amount_paid), 0) as "pending!" from fees where status != 'paid'"#)
        .fetch_one(&state.pool)
        .await?
        .pending;

    let open_grievances = sqlx::query!(r#"select count(*) as "c!" from helpdesk_tickets where status in ('open','in_progress')"#)
        .fetch_one(&state.pool)
        .await?
        .c;
    let certificates_issued = sqlx::query!(r#"select count(*) as "c!" from certificates where status = 'ready'"#).fetch_one(&state.pool).await?.c;

    let risk = all_student_risk_profiles(&state.pool).await?;
    let at_risk_count = risk.iter().filter(|r| r.risk_level != "low").count();

    let by_department = sqlx::query!(
        r#"
        select d.code, d.name, count(*) as "students!",
               avg(case when a.total > 0 then a.present * 100.0 / a.total else null end)::float8 as avg_attendance
        from students s
        join departments d on d.id = s.department_id
        left join (
          select student_id, count(*) total, sum(case when status in ('present','excused') then 1 else 0 end) present
          from attendance group by student_id
        ) a on a.student_id = s.id
        where s.status = 'active'
        group by d.id
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(json!({
        "totalStudents": total_students,
        "avgAttendance": avg_attendance,
        "pendingFees": fee_pending,
        "openGrievances": open_grievances,
        "certificatesIssued": certificates_issued,
        "atRiskCount": at_risk_count,
        "byDepartment": by_department.into_iter().map(|r| json!({
            "code": r.code, "name": r.name, "students": r.students,
            "avgAttendance": r.avg_attendance.map(|v| (v * 10.0).round() / 10.0),
        })).collect::<Vec<_>>(),
    })))
}

#[derive(Debug, Deserialize)]
struct NotifyBody {
    #[serde(rename = "studentIds")]
    student_ids: Vec<i32>,
    channel: Option<String>,
    message: Option<String>,
}

async fn notify(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<NotifyBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(
        &state.pool,
        &ctx,
        "student.communication.create",
        None,
        AuthorizeOptions { resource_label: Some(&format!("students:{}", body.student_ids.len())), force_audit: true },
    )
    .await?;

    let channel = body.channel.unwrap_or_else(|| "student".to_string());
    let message = body.message.unwrap_or_default();
    let title = if channel == "parent" { "Attendance alert sent to parent" } else { "Attendance alert" };

    let mut tx = state.pool.begin().await?;
    for student_id in &body.student_ids {
        sqlx::query!(
            r#"insert into notifications (university_id, student_id, audience_role, title, message, category) values (1, $1, $2, $3, $4, 'academic')"#,
            student_id,
            channel,
            title,
            message
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(Json(json!({ "notified": body.student_ids.len() })))
}
