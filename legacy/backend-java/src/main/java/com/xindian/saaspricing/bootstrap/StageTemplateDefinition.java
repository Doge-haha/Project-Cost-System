package com.xindian.saaspricing.bootstrap;

import java.util.List;

public record StageTemplateDefinition(
        List<StageTemplateItem> stages
) {
    public record StageTemplateItem(
            String code,
            String name,
            Integer order
    ) {
    }
}

