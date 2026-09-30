mod auth;
mod config;
mod error;
mod rbac;
mod routes;
mod state;

use axum::Router;
use sqlx::postgres::PgPoolOptions;

use config::Config;
use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    dotenvy::dotenv().ok();
    let config = Config::from_env();

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    let state = AppState { pool, import_jobs: Default::default() };
    let app = Router::new().merge(routes::router()).with_state(state);

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", config.port)).await?;
    tracing::info!("campus-backend listening on :{}", config.port);
    axum::serve(listener, app).await?;

    Ok(())
}
