APP_NAME = "saas-pricing-ai-runtime"

from .runtime_service import process_event_batch

__all__ = ["APP_NAME", "process_event_batch"]
