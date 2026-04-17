package com.xindian.saaspricing.bootstrap;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;

@Component
public class StageTemplateLoader {

    private final List<StageTemplateDefinition.StageTemplateItem> stages;

    public StageTemplateLoader() {
        this.stages = loadStages();
    }

    public List<StageTemplateDefinition.StageTemplateItem> loadDefaultStages() {
        return stages;
    }

    private List<StageTemplateDefinition.StageTemplateItem> loadStages() {
        ObjectMapper objectMapper = new ObjectMapper(new YAMLFactory());
        try (InputStream inputStream = new ClassPathResource("bootstrap/stage-templates.yml").getInputStream()) {
            StageTemplateDefinition definition = objectMapper.readValue(inputStream, StageTemplateDefinition.class);
            return definition.stages();
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to load stage templates", ex);
        }
    }
}

