package com.xindian.saaspricing.common.exception;

import java.util.Map;

public class ResourceLockedException extends RuntimeException {

    private final Map<String, Object> details;

    public ResourceLockedException(String message, Map<String, Object> details) {
        super(message);
        this.details = details;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}
