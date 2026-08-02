from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

from .config import settings


def _normalize_database_url(url: str) -> str:
    if not url:
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def get_engine():
    database_url = _normalize_database_url(settings.DATABASE_URL)
    print(f"[DATABASE] Connecting to: {database_url[:30]}...")


    connect_args = {}
    if database_url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
    elif database_url.startswith("postgresql"):
        connect_args = {"options": "-c timezone=Asia/Kolkata"}

    return create_engine(
        database_url,
        connect_args=connect_args,
        poolclass=NullPool if database_url.startswith("sqlite") else None,
    )


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        normalized_url = _normalize_database_url(settings.DATABASE_URL)
        if normalized_url.startswith("postgresql"):
            db.execute(text("SET TIME ZONE 'Asia/Kolkata'"))
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)


def sync_missing_columns():
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue

        existing_columns = {col["name"] for col in inspector.get_columns(table.name)}

        for column in table.columns:
            if column.name in existing_columns:
                continue

            column_type = column.type.compile(dialect=engine.dialect)
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {column_type}'

            with engine.connect() as conn:
                conn.execute(text(ddl))
                conn.commit()

            print(f"[Schema] Added missing column {table.name}.{column.name}")


def ensure_schema():
    create_tables()
    sync_missing_columns()
    from .seed import seed_database
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT COUNT(*) FROM candidates"))
        count = result.scalar()
        print(f"[STARTUP CHECK] Candidates table has {count} rows at startup")
    except Exception as e:
        print(f"[STARTUP CHECK] Error counting candidates: {e}")
    try:
        seed_database(db)
    finally:
        db.close()