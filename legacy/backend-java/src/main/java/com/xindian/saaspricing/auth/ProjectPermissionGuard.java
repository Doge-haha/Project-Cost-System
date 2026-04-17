package com.xindian.saaspricing.auth;

import java.util.UUID;

public interface ProjectPermissionGuard {

    void assertCanViewProject(UUID projectId);

    void assertCanViewProjectStage(UUID projectId, String stageCode);

    void assertCanViewProjectDiscipline(UUID projectId, String disciplineCode);

    void assertCanUseBusinessIdentity(UUID projectId, String businessIdentity);

    void assertCanEditProject(UUID projectId);

    void assertCanEditProjectStage(UUID projectId, String stageCode);

    void assertCanEditProjectDiscipline(UUID projectId, String disciplineCode);

    void assertCanViewStandardSets();
}
