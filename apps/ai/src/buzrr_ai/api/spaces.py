"""Knowledge Space CRUD."""

import uuid

from fastapi import APIRouter, status

from buzrr_ai.api.schemas import CreateSpaceBody, SpaceOut, UpdateSpaceBody
from buzrr_ai.auth import CurrentUser
from buzrr_ai.db.repositories import spaces as repo
from buzrr_ai.db.session import DbSession

router = APIRouter(prefix="/spaces", tags=["spaces"])


@router.get("", response_model=list[SpaceOut])
async def list_spaces(user: CurrentUser, db: DbSession) -> list[SpaceOut]:
    rows = await repo.list_spaces(db, user.user_id)
    return [
        SpaceOut(
            id=space.id,
            name=space.name,
            description=space.description,
            documentCount=total,
            readyCount=ready,
            createdAt=space.created_at,
            updatedAt=space.updated_at,
        )
        for space, total, ready in rows
    ]


@router.post("", response_model=SpaceOut, status_code=status.HTTP_201_CREATED)
async def create_space(body: CreateSpaceBody, user: CurrentUser, db: DbSession) -> SpaceOut:
    space = await repo.create_space(db, user.user_id, body.name.strip(), body.description)
    return SpaceOut(
        id=space.id,
        name=space.name,
        description=space.description,
        createdAt=space.created_at,
        updatedAt=space.updated_at,
    )


@router.get("/{space_id}", response_model=SpaceOut)
async def get_space(space_id: uuid.UUID, user: CurrentUser, db: DbSession) -> SpaceOut:
    space = await repo.get_space(db, user.user_id, space_id)
    return SpaceOut(
        id=space.id,
        name=space.name,
        description=space.description,
        createdAt=space.created_at,
        updatedAt=space.updated_at,
    )


@router.patch("/{space_id}", response_model=SpaceOut)
async def update_space(
    space_id: uuid.UUID, body: UpdateSpaceBody, user: CurrentUser, db: DbSession
) -> SpaceOut:
    space = await repo.update_space(
        db,
        user.user_id,
        space_id,
        name=body.name.strip() if body.name else None,
        description=body.description,
    )
    return SpaceOut(
        id=space.id,
        name=space.name,
        description=space.description,
        createdAt=space.created_at,
        updatedAt=space.updated_at,
    )


@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_space(space_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    await repo.delete_space(db, user.user_id, space_id)
