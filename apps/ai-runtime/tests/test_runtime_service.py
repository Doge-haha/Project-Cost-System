from app.runtime_service import process_event_batch


def test_process_event_batch_returns_runtime_and_structured_result() -> None:
    payload = {
        "source": "audit_log",
        "events": [
            {
                "projectId": "project-001",
                "stageCode": "estimate",
                "resourceType": "review_submission",
                "resourceId": "review-001",
                "action": "reject",
                "operatorId": "reviewer-001",
                "afterPayload": {
                    "billVersionId": "bill-version-001",
                    "reason": "Need material evidence",
                },
            }
        ],
    }

    result = process_event_batch(payload)

    assert result["runtime"] == "saas-pricing-ai-runtime:knowledge-memory-agent-runtime"
    assert result["source"] == "audit_log"
    assert result["result"]["summary"] == {
        "inputCount": 1,
        "processedCount": 1,
        "skippedCount": 0,
        "knowledgeCount": 1,
        "memoryCount": 1,
    }
    assert result["result"]["knowledgeCandidates"][0]["title"] == "review_reject"


def test_process_event_batch_rejects_non_list_events() -> None:
    try:
        process_event_batch({"events": "not-a-list"})
    except ValueError as error:
        assert str(error) == "events must be a list"
    else:
        raise AssertionError("expected ValueError")
