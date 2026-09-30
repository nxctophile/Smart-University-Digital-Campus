use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Sign in to continue.")]
    Unauthenticated,
    #[error("{0}")]
    AccessDenied(String),
    #[error("{0}")]
    BadRequest(String),
    #[error(transparent)]
    Internal(#[from] anyhow::Error),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl AppError {
    pub fn denied() -> Self {
        AppError::AccessDenied("You don't have permission to access this resource.".to_string())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Unauthenticated => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::AccessDenied(_) => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            AppError::Db(err) => {
                tracing::error!(?err, "database error");
                (StatusCode::BAD_REQUEST, "Something went wrong.".to_string())
            }
            AppError::Internal(err) => {
                tracing::error!(?err, "internal error");
                (StatusCode::BAD_REQUEST, "Something went wrong.".to_string())
            }
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
