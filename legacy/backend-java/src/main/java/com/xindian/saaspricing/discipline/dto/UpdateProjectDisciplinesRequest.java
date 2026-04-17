package com.xindian.saaspricing.discipline.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record UpdateProjectDisciplinesRequest(
        @NotEmpty List<@Valid Item> items
) {
    public record Item(
            @NotNull String disciplineCode,
            String standardSetCode,
            @NotNull Integer sortOrder,
            @NotNull Boolean isEnabled
    ) {
    }
}

