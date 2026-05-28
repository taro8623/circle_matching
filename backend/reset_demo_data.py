from sqlalchemy import delete

from database import SessionLocal
from models import Base


def main() -> None:
    db = SessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(delete(table))
        db.commit()
        print("Demo data reset complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
