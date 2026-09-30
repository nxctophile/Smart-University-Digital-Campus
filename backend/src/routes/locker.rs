use axum::body::Bytes;
use axum::extract::{Multipart, Path, State};
use axum::http::header;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, resolve_student_id_for_access, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/locker", get(list).post(upload))
        .route("/api/locker/:id", axum::routing::delete(remove))
        .route("/api/locker/:id/file", get(file))
        .route("/api/admin/locker/:id/file", get(file_for_reviewer))
}

async fn list(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "documents.locker.manage", None).await?;
    let rows = sqlx::query!(
        "select id, category, title, file_name, mime_type, status, uploaded_at from student_documents where student_id = $1 order by uploaded_at desc",
        student_id
    )
    .fetch_all(&state.pool)
    .await?;

    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "category": r.category, "title": r.title, "fileName": r.file_name,
            "mimeType": r.mime_type, "status": r.status, "uploadedAt": r.uploaded_at,
        }))
        .collect();

    Ok(Json(json!({ "documents": out })))
}

async fn upload(State(state): State<AppState>, Session(ctx): Session, mut multipart: Multipart) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "documents.locker.manage", None).await?;

    let mut category = "other".to_string();
    let mut title = String::new();
    let mut file_name = "upload".to_string();
    let mut mime_type = "application/octet-stream".to_string();
    let mut bytes: Option<Bytes> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::BadRequest(e.to_string()))? {
        match field.name().unwrap_or("") {
            "category" => category = field.text().await.unwrap_or_default(),
            "title" => title = field.text().await.unwrap_or_default(),
            "file" => {
                file_name = field.file_name().unwrap_or("upload").to_string();
                mime_type = field.content_type().unwrap_or("application/octet-stream").to_string();
                bytes = Some(field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?);
            }
            _ => {}
        }
    }

    let bytes = bytes.ok_or_else(|| AppError::BadRequest("No file provided".to_string()))?;
    if title.is_empty() {
        title = file_name.clone();
    }

    let row = sqlx::query!(
        r#"insert into student_documents (student_id, category, title, file_name, mime_type, file_data)
           values ($1, $2, $3, $4, $5, $6) returning id, uploaded_at"#,
        student_id,
        category,
        title,
        file_name,
        mime_type,
        bytes.as_ref()
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({
        "document": { "id": row.id, "category": category, "title": title, "fileName": file_name, "mimeType": mime_type, "status": "verified", "uploadedAt": row.uploaded_at },
    })))
}

async fn remove(State(state): State<AppState>, Session(ctx): Session, Path(id): Path<i32>) -> AppResult<Json<serde_json::Value>> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "documents.locker.manage", None).await?;
    let result = sqlx::query!("delete from student_documents where id = $1 and student_id = $2", id, student_id)
        .execute(&state.pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest("Document not found.".to_string()));
    }
    Ok(Json(json!({ "success": true })))
}

async fn file(State(state): State<AppState>, Session(ctx): Session, Path(id): Path<i32>) -> AppResult<Response> {
    let student_id = resolve_student_id_for_access(&state.pool, &ctx, "documents.locker.manage", None).await?;
    let row = sqlx::query!(
        "select file_data, mime_type, file_name from student_documents where id = $1 and student_id = $2",
        id,
        student_id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::BadRequest("Document not found.".to_string()))?;

    let mut response = row.file_data.into_response();
    response.headers_mut().insert(header::CONTENT_TYPE, row.mime_type.parse().unwrap());
    response
        .headers_mut()
        .insert(header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", row.file_name).parse().unwrap());
    Ok(response)
}

/// Used by other routes (profile edit review, smart card) that need to
/// serve a specific student's document to a caller other than the student
/// themselves (e.g. the admission cell reviewing an attached proof).
pub async fn file_for_reviewer(State(state): State<AppState>, Session(ctx): Session, Path(id): Path<i32>) -> AppResult<Response> {
    authorize(&state.pool, &ctx, "profile.update.review", None, AuthorizeOptions::default()).await?;
    let row = sqlx::query!("select file_data, mime_type, file_name from student_documents where id = $1", id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest("Document not found.".to_string()))?;

    let mut response = row.file_data.into_response();
    response.headers_mut().insert(header::CONTENT_TYPE, row.mime_type.parse().unwrap());
    response
        .headers_mut()
        .insert(header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", row.file_name).parse().unwrap());
    Ok(response)
}
