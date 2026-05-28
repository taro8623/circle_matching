import os
from dataclasses import dataclass

from database import SessionLocal
from deps import hash_password
from models import Circle, CircleMember, User, UserPart


@dataclass(frozen=True)
class DemoUserSpec:
    name: str
    email: str
    bio: str
    parts: list[tuple[str, str | None]]
    favorite_artists: list[str]


DEMO_USERS = [
    DemoUserSpec(
        name="葵",
        email="demo.roots.01@example.com",
        bio="都内で活動している女性Vo。オルタナとJ-POPが好きで、コーラスワークも得意です。",
        parts=[("Vo", None), ("Cho", None)],
        favorite_artists=["東京事変", "椎名林檎", "Cocco"],
    ),
    DemoUserSpec(
        name="蓮",
        email="demo.roots.02@example.com",
        bio="ギターロック中心のLead Gt。ライブではアレンジを詰めるのが好きです。",
        parts=[("Gt", None)],
        favorite_artists=["ASIAN KUNG-FU GENERATION", "ELLEGARDEN", "BUMP OF CHICKEN"],
    ),
    DemoUserSpec(
        name="芽衣",
        email="demo.roots.03@example.com",
        bio="ベース担当。シティポップとファンク寄りのグルーヴを出すのが得意です。",
        parts=[("Ba", None)],
        favorite_artists=["Suchmos", "Nulbarich", "Jamiroquai"],
    ),
    DemoUserSpec(
        name="駿",
        email="demo.roots.04@example.com",
        bio="ドラム担当。8ビートから歌モノのダイナミクス作りまで広く対応します。",
        parts=[("Dr", None)],
        favorite_artists=["UNISON SQUARE GARDEN", "the HIATUS", "ONE OK ROCK"],
    ),
    DemoUserSpec(
        name="奈々",
        email="demo.roots.05@example.com",
        bio="鍵盤担当。ピアノ、パッド、シンセを使い分けて曲の雰囲気を作ります。",
        parts=[("Key", None)],
        favorite_artists=["Official髭男dism", "東京事変", "Mrs. GREEN APPLE"],
    ),
    DemoUserSpec(
        name="陽",
        email="demo.roots.06@example.com",
        bio="ハモりとサブボーカルが得意。女性Vo曲の厚みを出すのが好きです。",
        parts=[("Cho", None)],
        favorite_artists=["aiko", "YUKI", "いきものがかり"],
    ),
    DemoUserSpec(
        name="悠樹",
        email="demo.roots.07@example.com",
        bio="カッティングもリードもやるギター担当。ブラックミュージック由来のノリが好きです。",
        parts=[("Gt", None), ("Cho", None)],
        favorite_artists=["Vaundy", "BRUNO MARS", "Lenny Kravitz"],
    ),
    DemoUserSpec(
        name="康太",
        email="demo.roots.08@example.com",
        bio="5弦ベース中心。歌モノで下を支えつつ、必要なら前にも出ます。",
        parts=[("Ba", None)],
        favorite_artists=["King Gnu", "millennium parade", "Red Hot Chili Peppers"],
    ),
    DemoUserSpec(
        name="里奈",
        email="demo.roots.09@example.com",
        bio="Vo/Key兼任。ポップスからバラードまで、女性曲の再現が得意です。",
        parts=[("Vo", None), ("Key", None)],
        favorite_artists=["宇多田ヒカル", "藤井 風", "Alicia Keys"],
    ),
    DemoUserSpec(
        name="大地",
        email="demo.roots.10@example.com",
        bio="サックス担当。ホーンを入れたアレンジやゲスト参加が好きです。",
        parts=[("Other", "Sax")],
        favorite_artists=["東京スカパラダイスオーケストラ", "Snarky Puppy", "Bruno Mars"],
    ),
]

OWNER_SPEC = DemoUserSpec(
    name="Roots運営",
    email="demo.roots.owner@example.com",
    bio="roots の公開デモ運営アカウントです。ライブ管理や権限設定の挙動確認に使えます。",
    parts=[("Gt", None)],
    favorite_artists=["東京事変", "ASIAN KUNG-FU GENERATION", "UNISON SQUARE GARDEN"],
)


def sync_parts(user: User, spec: DemoUserSpec) -> None:
    desired = {(part, detail) for part, detail in spec.parts}
    existing = {(part.part, part.part_detail): part for part in user.parts}

    for key, part in existing.items():
        if key not in desired:
            user.parts.remove(part)

    for part, detail in spec.parts:
        if (part, detail) not in existing:
            user.parts.append(UserPart(part=part, part_detail=detail))


def upsert_user(db, spec: DemoUserSpec, password: str) -> tuple[User, bool]:
    user = db.query(User).filter(User.email == spec.email).first()
    created = False
    if user is None:
        user = User(
            name=spec.name,
            email=spec.email,
            password_hash=hash_password(password),
            bio=spec.bio,
            favorite_artists=spec.favorite_artists,
        )
        db.add(user)
        db.flush()
        created = True
    else:
        user.name = spec.name
        user.bio = spec.bio
        user.favorite_artists = spec.favorite_artists
        user.password_hash = hash_password(password)

    sync_parts(user, spec)
    return user, created


def ensure_membership(db, circle: Circle, user: User, role: str) -> bool:
    membership = (
        db.query(CircleMember)
        .filter(
            CircleMember.circle_id == circle.id,
            CircleMember.user_id == user.id,
        )
        .order_by(CircleMember.joined_at.desc())
        .first()
    )
    if membership is None:
        db.add(CircleMember(circle_id=circle.id, user_id=user.id, role=role))
        return False
    if membership.left_at is not None:
        membership.left_at = None
        membership.role = role
        return True
    membership.role = role
    return False


def main() -> None:
    password = os.environ.get("ROOTS_DEMO_PASSWORD", "RootsDemo2026!")
    circle_name = os.environ.get("ROOTS_CIRCLE_NAME", "roots")
    join_password = os.environ.get("ROOTS_CIRCLE_JOIN_PASSWORD", "roots-demo")
    db = SessionLocal()

    try:
        owner, owner_created = upsert_user(db, OWNER_SPEC, password)

        circle = db.query(Circle).filter(Circle.name == circle_name).first()
        if circle is None:
            circle = Circle(
                name=circle_name,
                join_password=join_password,
                description="公開デモ用のサークルです。自由に曲起票や参加申請を試せます。",
            )
            db.add(circle)
            db.flush()
        else:
            circle.join_password = join_password
            circle.description = "公開デモ用のサークルです。自由に曲起票や参加申請を試せます。"

        created_count = 1 if owner_created else 0
        revived_count = 0
        if ensure_membership(db, circle, owner, "owner"):
            revived_count += 1

        for spec in DEMO_USERS:
            user, created = upsert_user(db, spec, password)
            if created:
                created_count += 1
            if ensure_membership(db, circle, user, "member"):
                revived_count += 1

        db.commit()

        member_count = (
            db.query(CircleMember)
            .filter(CircleMember.circle_id == circle.id, CircleMember.left_at.is_(None))
            .count()
        )
        print(f"Created demo users: {created_count}")
        print(f"Reactivated memberships: {revived_count}")
        print(f"Demo circle: {circle.name}")
        print(f"Circle join password: {join_password}")
        print(f"Active {circle.name} members: {member_count}")
        print(f"Demo password: {password}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
