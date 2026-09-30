use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use sqlx::PgPool;

use crate::auth::Session;
use crate::error::AppResult;
use crate::rbac::{resolve_student_id_for_access, AccessContext};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/documents", get(documents)).route("/api/certificates", post(request_certificate))
}

pub async fn list_documents(pool: &PgPool, ctx: &AccessContext, requested_student_id: Option<i32>) -> AppResult<serde_json::Value> {
    let student_id = resolve_student_id_for_access(pool, ctx, "documents.view", requested_student_id).await?;
    let docs = sqlx::query!("select * from documents where student_id = $1", student_id).fetch_all(pool).await?;
    let certs = sqlx::query!("select * from certificates where student_id = $1", student_id).fetch_all(pool).await?;

    let docs_json: Vec<_> = docs
        .into_iter()
        .map(|d| json!({ "id": d.id, "studentId": d.student_id, "type": d.r#type, "title": d.title, "issuedAt": d.issued_at, "status": d.status }))
        .collect();
    let certs_json: Vec<_> = certs
        .into_iter()
        .map(|c| json!({
            "id": c.id, "studentId": c.student_id, "type": c.r#type, "status": c.status, "requestedAt": c.requested_at,
            "issuedAt": c.issued_at, "verificationCode": c.verification_code, "purpose": c.purpose, "requestedVia": c.requested_via,
        }))
        .collect();

    Ok(json!({ "documents": docs_json, "certificates": certs_json }))
}

async fn documents(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(list_documents(&state.pool, &ctx, None).await?))
}

async fn check_eligibility(pool: &PgPool, student_id: i32) -> AppResult<serde_json::Value> {
    let student = sqlx::query!("select first_name, last_name, roll_number, status from students where id = $1", student_id)
        .fetch_optional(pool)
        .await?;
    let has_overdue = sqlx::query!("select 1 as x from fees where student_id = $1 and status = 'overdue' limit 1", student_id)
        .fetch_optional(pool)
        .await?
        .is_some();

    let identity_passed = student.is_some();
    let enrollment_passed = student.as_ref().is_some_and(|s| s.status == "active");
    let checks = json!([
        { "label": "Identity verified", "passed": identity_passed, "detail": student.as_ref().map(|s| format!("{} {} ({})", s.first_name, s.last_name, s.roll_number)).unwrap_or_else(|| "Student not found".to_string()) },
        { "label": "Enrollment verified", "passed": enrollment_passed, "detail": student.as_ref().map(|s| format!("Status: {}", s.status)).unwrap_or_default() },
        { "label": "No blocking dues", "passed": !has_overdue, "detail": if has_overdue { "There is an overdue fee balance" } else { "No overdue fees on record" } },
    ]);
    let eligible = identity_passed && enrollment_passed && !has_overdue;

    Ok(json!({ "eligible": eligible, "checks": checks }))
}

pub async fn request_certificate_for(
    pool: &PgPool,
    ctx: &AccessContext,
    requested_student_id: Option<i32>,
    cert_type: &str,
    purpose: &str,
    via: &str,
) -> AppResult<serde_json::Value> {
    let student_id = resolve_student_id_for_access(pool, ctx, "documents.certificate.request", requested_student_id).await?;
    let eligibility = check_eligibility(pool, student_id).await?;
    if eligibility["eligible"] != json!(true) {
        return Ok(json!({ "success": false, "eligibility": eligibility, "certificate": null }));
    }

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let verification_code = format!("CIT-CERT-{student_id}-{:X}", chrono::Utc::now().timestamp_millis());

    let row = sqlx::query!(
        r#"insert into certificates (student_id, type, status, requested_at, issued_at, verification_code, purpose, requested_via)
           values ($1, $2, 'ready', $3, $3, $4, $5, $6) returning *"#,
        student_id,
        cert_type,
        today,
        verification_code,
        purpose,
        via
    )
    .fetch_one(pool)
    .await?;

    let certificate = json!({
        "id": row.id, "studentId": row.student_id, "type": row.r#type, "status": row.status, "requestedAt": row.requested_at,
        "issuedAt": row.issued_at, "verificationCode": row.verification_code, "purpose": row.purpose, "requestedVia": row.requested_via,
    });

    Ok(json!({ "success": true, "eligibility": eligibility, "certificate": certificate }))
}

#[derive(Debug, Deserialize)]
struct RequestCertBody {
    #[serde(rename = "type")]
    cert_type: Option<String>,
    purpose: Option<String>,
}

async fn request_certificate(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<RequestCertBody>) -> AppResult<Json<serde_json::Value>> {
    let result = request_certificate_for(
        &state.pool,
        &ctx,
        None,
        body.cert_type.as_deref().unwrap_or("bonafide"),
        body.purpose.as_deref().unwrap_or("General purpose"),
        "web",
    )
    .await?;
    Ok(Json(result))
}
