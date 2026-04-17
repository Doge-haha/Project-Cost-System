package com.xindian.saaspricing.discipline.controller;

import com.xindian.saaspricing.discipline.dto.StandardSetResponse;
import com.xindian.saaspricing.discipline.service.ProjectDisciplineService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/standard-sets")
public class StandardSetController {

    private final ProjectDisciplineService projectDisciplineService;

    public StandardSetController(ProjectDisciplineService projectDisciplineService) {
        this.projectDisciplineService = projectDisciplineService;
    }

    @GetMapping
    public Map<String, List<StandardSetResponse>> listStandardSets(
            @RequestParam(required = false) String disciplineCode,
            @RequestParam(required = false) String regionCode,
            @RequestParam(required = false) String status
    ) {
        return Map.of("items", projectDisciplineService.listStandardSets(disciplineCode, regionCode, status));
    }
}

