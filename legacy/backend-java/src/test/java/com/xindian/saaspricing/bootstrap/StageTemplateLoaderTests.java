package com.xindian.saaspricing.bootstrap;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StageTemplateLoaderTests {

    @Test
    void shouldLoadNineDefaultStages() {
        StageTemplateLoader loader = new StageTemplateLoader();

        assertEquals(9, loader.loadDefaultStages().size());
        assertEquals("stage_01", loader.loadDefaultStages().get(0).code());
        assertEquals("stage_09", loader.loadDefaultStages().get(8).code());
    }
}

