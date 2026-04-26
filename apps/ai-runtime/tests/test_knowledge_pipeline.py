from app.knowledge_pipeline import extract_candidates, extract_candidates_batch


def test_extract_candidates_builds_review_knowledge_and_memory() -> None:
    result = extract_candidates(
        {
            "projectId": "project-001",
            "stageCode": "estimate",
            "resourceType": "review_submission",
            "resourceId": "review-001",
            "action": "reject",
            "operatorId": "reviewer-001",
            "afterPayload": {
                "billVersionId": "bill-version-001",
                "reason": "Unit price basis is incomplete",
                "comment": "Need material evidence",
            },
        }
    )

    assert len(result.knowledge_candidates) == 1
    assert result.knowledge_candidates[0].title == "review_reject"
    assert result.knowledge_candidates[0].summary == "Unit price basis is incomplete"
    assert result.knowledge_candidates[0].tags == ("review", "reject")
    assert len(result.memory_candidates) == 1
    assert result.memory_candidates[0].memory_key == (
        "project-001:reviewer-001:review_submission:reject"
    )


def test_extract_candidates_builds_process_document_knowledge() -> None:
    result = extract_candidates(
        {
            "projectId": "project-001",
            "stageCode": "construction",
            "resourceType": "process_document",
            "resourceId": "doc-001",
            "action": "submit",
            "operatorId": "engineer-001",
            "afterPayload": {
                "documentType": "change_order",
                "referenceNo": "BG-2026-015",
                "amount": 12500,
                "comment": "Owner requested concrete upgrade",
            },
        }
    )

    assert len(result.knowledge_candidates) == 1
    candidate = result.knowledge_candidates[0]
    assert candidate.title == "change_order_submit"
    assert "BG-2026-015" in candidate.summary
    assert candidate.metadata["amount"] == 12500
    assert len(result.memory_candidates) == 0


def test_extract_candidates_builds_bill_version_knowledge_and_memory() -> None:
    result = extract_candidates(
        {
            "projectId": "project-001",
            "stageCode": "estimate",
            "resourceType": "bill_version",
            "resourceId": "bill-version-001",
            "action": "submit",
            "operatorId": "engineer-001",
            "afterPayload": {
                "status": "submitted",
                "versionCode": "EST-001",
            },
        }
    )

    assert len(result.knowledge_candidates) == 1
    candidate = result.knowledge_candidates[0]
    assert candidate.title == "bill_version_submit"
    assert candidate.summary == "bill version | submit | EST-001 | status=submitted"
    assert candidate.tags == ("bill_version", "submit")
    assert len(result.memory_candidates) == 1
    assert result.memory_candidates[0].memory_key == (
        "project-001:engineer-001:bill_version:submit"
    )


def test_extract_candidates_requires_project_id() -> None:
    try:
        extract_candidates(
            {
                "resourceType": "review_submission",
                "action": "approve",
            }
        )
    except ValueError as error:
        assert str(error) == "projectId is required"
    else:
        raise AssertionError("expected ValueError")


def test_extract_candidates_batch_aggregates_counts_and_deduplicates_memory() -> None:
    result = extract_candidates_batch(
        [
            {
                "projectId": "project-001",
                "stageCode": "estimate",
                "resourceType": "review_submission",
                "resourceId": "review-001",
                "action": "reject",
                "operatorId": "reviewer-001",
                "afterPayload": {
                    "billVersionId": "bill-version-001",
                    "reason": "Unit price basis is incomplete",
                },
            },
            {
                "projectId": "project-001",
                "stageCode": "estimate",
                "resourceType": "review_submission",
                "resourceId": "review-001",
                "action": "reject",
                "operatorId": "reviewer-001",
                "afterPayload": {
                    "billVersionId": "bill-version-001",
                    "reason": "Unit price basis is incomplete",
                },
            },
            {
                "resourceType": "review_submission",
                "action": "approve",
            },
        ]
    )

    assert result.summary == {
        "inputCount": 3,
        "processedCount": 2,
        "skippedCount": 1,
        "knowledgeCount": 2,
        "memoryCount": 1,
    }
    assert len(result.knowledge_candidates) == 2
    assert len(result.memory_candidates) == 1
    assert result.memory_candidates[0].memory_key == (
        "project-001:reviewer-001:review_submission:reject"
    )
