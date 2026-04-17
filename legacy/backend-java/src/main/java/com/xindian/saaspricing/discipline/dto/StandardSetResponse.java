package com.xindian.saaspricing.discipline.dto;

import java.util.UUID;

public record StandardSetResponse(
        UUID id,
        String standardSetCode,
        String standardSetName,
        String disciplineCode,
        Integer versionYear,
        String standardType,
        String regionCode,
        String sourceSystem,
        String status
) {
}

