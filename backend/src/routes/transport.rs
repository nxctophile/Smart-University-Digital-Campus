use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use sqlx::PgPool;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::resolve_student_id_for_access;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/transport", get(info).patch(update))
        .route("/api/transport/routes", get(routes_with_stops))
}

async fn transport_info(pool: &PgPool, student_id: i32) -> AppResult<Option<serde_json::Value>> {
    let row = sqlx::query!(
        r#"
        select r.id as route_id, r.name as route_name, r.code as route_code, r.vehicle_number, r.driver_name,
               s.id as stop_id, s.name as stop_name, s.arrival_time
        from transport_assignments ta
        join transport_routes r on r.id = ta.route_id
        join transport_stops s on s.id = ta.stop_id
        where ta.student_id = $1
        "#,
        student_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| json!({
        "routeId": r.route_id, "routeName": r.route_name, "routeCode": r.route_code, "vehicleNumber": r.vehicle_number,
        "driverName": r.driver_name, "stopId": r.stop_id, "stopName": r.stop_name, "arrivalTime": r.arrival_time,
    })))
}

async fn info(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "transport.view", None).await?;
    Ok(Json(json!({ "info": transport_info(&state.pool, student_id).await? })))
}

#[derive(Debug, Deserialize)]
struct UpdateBody {
    #[serde(rename = "routeId")]
    route_id: i32,
    #[serde(rename = "stopId")]
    stop_id: i32,
}

async fn update(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<UpdateBody>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "transport.update", None).await?;

    let stop = sqlx::query!("select route_id from transport_stops where id = $1", body.stop_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("That stop doesn't belong to the selected route.".to_string()))?;
    if stop.route_id != body.route_id {
        return Err(AppError::BadRequest("That stop doesn't belong to the selected route.".to_string()));
    }

    let existing = sqlx::query!("select id from transport_assignments where student_id = $1", student_id).fetch_optional(&state.pool).await?;
    if let Some(existing) = existing {
        sqlx::query!("update transport_assignments set route_id = $1, stop_id = $2 where id = $3", body.route_id, body.stop_id, existing.id)
            .execute(&state.pool)
            .await?;
    } else {
        sqlx::query!(
            "insert into transport_assignments (student_id, route_id, stop_id) values ($1, $2, $3)",
            student_id,
            body.route_id,
            body.stop_id
        )
        .execute(&state.pool)
        .await?;
    }

    Ok(Json(json!({ "info": transport_info(&state.pool, student_id).await? })))
}

async fn routes_with_stops(State(state): State<AppState>) -> AppResult<Json<serde_json::Value>> {
    let routes = sqlx::query!("select * from transport_routes").fetch_all(&state.pool).await?;
    let stops = sqlx::query!("select * from transport_stops order by sequence").fetch_all(&state.pool).await?;

    let out: Vec<_> = routes
        .into_iter()
        .map(|r| {
            let route_stops: Vec<_> = stops
                .iter()
                .filter(|s| s.route_id == r.id)
                .map(|s| json!({ "id": s.id, "routeId": s.route_id, "name": s.name, "sequence": s.sequence, "arrivalTime": s.arrival_time }))
                .collect();
            json!({
                "id": r.id, "universityId": r.university_id, "name": r.name, "code": r.code,
                "vehicleNumber": r.vehicle_number, "driverName": r.driver_name, "capacity": r.capacity, "stops": route_stops,
            })
        })
        .collect();

    Ok(Json(json!({ "routes": out })))
}
