use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::resolve_student_id_for_access;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/helpdesk/tickets", get(my_tickets).post(create))
}

async fn my_tickets(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "helpdesk.ticket.view", None).await?;
    let rows = sqlx::query!("select * from helpdesk_tickets where student_id = $1 order by created_at desc", student_id)
        .fetch_all(&state.pool)
        .await?;
    let out: Vec<_> = rows
        .into_iter()
        .map(|t| json!({
            "id": t.id, "ticketNumber": t.ticket_number, "studentId": t.student_id, "category": t.category, "subject": t.subject,
            "description": t.description, "status": t.status, "priority": t.priority, "createdVia": t.created_via,
            "assignedTo": t.assigned_to, "createdAt": t.created_at, "updatedAt": t.updated_at,
        }))
        .collect();
    Ok(Json(json!({ "tickets": out })))
}

#[derive(Debug, Deserialize)]
struct CreateBody {
    category: String,
    subject: String,
    description: String,
}

async fn create(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<CreateBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "helpdesk.ticket.create", None).await?;
    let ticket_number = format!("HD-{:X}", chrono::Utc::now().timestamp_millis());

    let ticket = sqlx::query!(
        r#"insert into helpdesk_tickets (ticket_number, student_id, category, subject, description, status, priority, created_via)
           values ($1, $2, $3, $4, $5, 'open', 'medium', 'web') returning *"#,
        ticket_number,
        student_id,
        body.category,
        body.subject,
        body.description
    )
    .fetch_one(&state.pool)
    .await?;

    sqlx::query!("insert into ticket_messages (ticket_id, sender, message) values ($1, 'student', $2)", ticket.id, body.description)
        .execute(&state.pool)
        .await?;

    Ok(Json(json!({ "ticket": {
        "id": ticket.id, "ticketNumber": ticket.ticket_number, "studentId": ticket.student_id, "category": ticket.category,
        "subject": ticket.subject, "description": ticket.description, "status": ticket.status, "priority": ticket.priority,
        "createdVia": ticket.created_via, "assignedTo": ticket.assigned_to, "createdAt": ticket.created_at, "updatedAt": ticket.updated_at,
    } })))
}
