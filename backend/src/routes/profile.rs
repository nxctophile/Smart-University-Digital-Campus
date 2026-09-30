use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::authorize;
use crate::rbac::AuthorizeOptions;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/profile", get(profile))
}

async fn profile(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    if ctx.student_id.is_some() || ctx.parent_id.is_some() {
        let profile = crate::routes::students::student_profile(&state.pool, &ctx, None).await?;
        return Ok(Json(json!({ "ctx": ctx.to_client(), "profile": profile })));
    }
    if let Some(faculty_id) = ctx.faculty_id {
        authorize(&state.pool, &ctx, "class.view", None, AuthorizeOptions::default()).await?;
        let row = sqlx::query!("select * from faculty where id = $1", faculty_id).fetch_optional(&state.pool).await?;
        let profile = row.map(|f| json!({
            "id": f.id, "universityId": f.university_id, "departmentId": f.department_id, "employeeId": f.employee_id,
            "firstName": f.first_name, "lastName": f.last_name, "email": f.email, "phone": f.phone, "designation": f.designation,
        }));
        return Ok(Json(json!({ "ctx": ctx.to_client(), "profile": profile })));
    }
    Ok(Json(json!({ "ctx": ctx.to_client(), "profile": null })))
}
