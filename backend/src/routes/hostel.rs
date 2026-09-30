use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::resolve_student_id_for_access;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/hostel", get(hostel))
}

async fn hostel(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "hostel.view", None).await?;
    let row = sqlx::query!(
        r#"
        select h.name as hostel_name, h.block, h.warden, r.room_number, r.capacity, ra.assigned_at
        from room_assignments ra
        join rooms r on r.id = ra.room_id
        join hostels h on h.id = r.hostel_id
        where ra.student_id = $1 and ra.status = 'active'
        "#,
        student_id
    )
    .fetch_optional(&state.pool)
    .await?;

    let info = row.map(|r| json!({
        "hostelName": r.hostel_name, "block": r.block, "warden": r.warden,
        "roomNumber": r.room_number, "capacity": r.capacity, "assignedAt": r.assigned_at,
    }));

    Ok(Json(json!({ "info": info })))
}
