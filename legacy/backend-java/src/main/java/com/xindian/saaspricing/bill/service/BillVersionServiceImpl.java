package com.xindian.saaspricing.bill.service;

import com.xindian.saaspricing.auth.ProjectScopedAuthorizationService;
import com.xindian.saaspricing.auth.ProjectPermissionGuard;
import com.xindian.saaspricing.bill.dto.BillItemResponse;
import com.xindian.saaspricing.bill.dto.BillItemWorkItemResponse;
import com.xindian.saaspricing.bill.dto.BillVersionContext;
import com.xindian.saaspricing.bill.dto.BillVersionResponse;
import com.xindian.saaspricing.bill.dto.BillVersionValidationIssue;
import com.xindian.saaspricing.bill.dto.BillVersionValidationSummary;
import com.xindian.saaspricing.bill.dto.CreateBillVersionRequest;
import com.xindian.saaspricing.bill.repository.BillItemRepository;
import com.xindian.saaspricing.bill.repository.BillItemWorkItemRepository;
import com.xindian.saaspricing.bill.repository.BillVersionRepository;
import com.xindian.saaspricing.common.exception.NotFoundException;
import com.xindian.saaspricing.common.exception.ResourceLockedException;
import com.xindian.saaspricing.common.exception.ValidationException;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class BillVersionServiceImpl implements BillVersionService {

    private final BillVersionRepository billVersionRepository;
    private final BillItemRepository billItemRepository;
    private final BillItemWorkItemRepository billItemWorkItemRepository;
    private final ProjectScopedAuthorizationService authorizationService;
    private final ProjectPermissionGuard projectPermissionGuard;

    public BillVersionServiceImpl(
            BillVersionRepository billVersionRepository,
            BillItemRepository billItemRepository,
            BillItemWorkItemRepository billItemWorkItemRepository,
            ProjectScopedAuthorizationService authorizationService,
            ProjectPermissionGuard projectPermissionGuard
    ) {
        this.billVersionRepository = billVersionRepository;
        this.billItemRepository = billItemRepository;
        this.billItemWorkItemRepository = billItemWorkItemRepository;
        this.authorizationService = authorizationService;
        this.projectPermissionGuard = projectPermissionGuard;
    }

    @Override
    public List<BillVersionResponse> listBillVersions(UUID projectId, String stageCode, String disciplineCode) {
        if (stageCode != null && !stageCode.isBlank()) {
            authorizationService.assertCanViewContext(projectId, stageCode, disciplineCode, null);
        }
        return billVersionRepository.findByProjectId(projectId, stageCode, disciplineCode);
    }

    @Override
    public BillVersionResponse createBillVersion(UUID projectId, CreateBillVersionRequest request) {
        authorizationService.assertCanEditContext(
                projectId,
                request.stageCode(),
                request.disciplineCode(),
                request.businessIdentity()
        );
        if (request.sourceVersionId() != null && billVersionRepository.findById(request.sourceVersionId()).isEmpty()) {
            throw new ValidationException("来源清单版本不存在", Map.of("sourceVersionId", request.sourceVersionId()));
        }
        OffsetDateTime now = OffsetDateTime.now();
        String sourceStageCode = billVersionRepository.findById(request.sourceVersionId())
                .map(com.xindian.saaspricing.bill.dto.BillVersionContext::stageCode)
                .orElse(null);
        BillVersionResponse response = new BillVersionResponse(
                UUID.randomUUID(),
                projectId,
                request.stageCode(),
                request.disciplineCode(),
                request.businessIdentity(),
                billVersionRepository.nextVersionNo(projectId, request.stageCode()),
                request.versionType(),
                "editable",
                "unlocked",
                sourceStageCode,
                request.sourceVersionId(),
                now,
                now
        );
        return billVersionRepository.save(response);
    }

    @Override
    public BillVersionResponse copyFromVersion(UUID projectId, UUID sourceVersionId) {
        BillVersionContext source = billVersionRepository.findById(sourceVersionId)
                .orElseThrow(() -> new NotFoundException("来源清单版本不存在"));
        if (!source.projectId().equals(projectId)) {
            throw new NotFoundException("来源清单版本不存在");
        }
        authorizationService.assertCanViewContext(projectId, source.stageCode(), source.disciplineCode(), source.businessIdentity());
        authorizationService.assertCanEditContext(projectId, source.stageCode(), source.disciplineCode(), source.businessIdentity());
        OffsetDateTime now = OffsetDateTime.now();
        BillVersionResponse copied = new BillVersionResponse(
                UUID.randomUUID(),
                projectId,
                source.stageCode(),
                source.disciplineCode(),
                source.businessIdentity(),
                billVersionRepository.nextVersionNo(projectId, source.stageCode()),
                "reference_copy",
                "editable",
                "unlocked",
                source.stageCode(),
                source.id(),
                now,
                now
        );
        BillVersionResponse saved = billVersionRepository.save(copied);
        copyBillItemsAndWorkItems(source.id(), saved.id());
        return saved;
    }

    @Override
    public List<BillVersionResponse> getSourceChain(UUID projectId, UUID versionId) {
        BillVersionContext current = billVersionRepository.findById(versionId)
                .orElseThrow(() -> new NotFoundException("清单版本不存在"));
        if (!current.projectId().equals(projectId)) {
            throw new NotFoundException("清单版本不存在");
        }
        authorizationService.assertCanViewContext(projectId, current.stageCode(), current.disciplineCode(), current.businessIdentity());

        List<BillVersionResponse> chain = new ArrayList<>();
        BillVersionContext cursor = current;
        while (cursor != null) {
            chain.add(toResponse(cursor));
            cursor = cursor.sourceVersionId() == null
                    ? null
                    : billVersionRepository.findById(cursor.sourceVersionId()).orElse(null);
        }
        return chain;
    }

    @Override
    public BillVersionResponse lockVersion(UUID projectId, UUID versionId) {
        BillVersionContext version = billVersionRepository.findById(versionId)
                .orElseThrow(() -> new NotFoundException("清单版本不存在"));
        if (!version.projectId().equals(projectId)) {
            throw new NotFoundException("清单版本不存在");
        }
        projectPermissionGuard.assertCanEditProject(projectId);
        return billVersionRepository.updateLockStatus(versionId, "locked");
    }

    @Override
    public BillVersionResponse submitVersion(UUID projectId, UUID versionId) {
        BillVersionContext version = requireVersion(projectId, versionId);
        authorizationService.assertCanEditContext(projectId, version.stageCode(), version.disciplineCode(), version.businessIdentity());
        assertEditable(version);
        BillVersionValidationSummary summary = buildValidationSummary(version);
        if (!summary.passed()) {
            throw new ValidationException("清单版本提交校验未通过", Map.of(
                    "versionId", version.id(),
                    "errorCount", summary.errorCount(),
                    "warningCount", summary.warningCount(),
                    "issues", summary.issues()
            ));
        }
        return billVersionRepository.updateVersionStatus(versionId, "submitted");
    }

    @Override
    public BillVersionResponse withdrawVersion(UUID projectId, UUID versionId) {
        BillVersionContext version = requireVersion(projectId, versionId);
        authorizationService.assertCanEditContext(projectId, version.stageCode(), version.disciplineCode(), version.businessIdentity());
        if (!"submitted".equals(version.versionStatus())) {
            throw new ValidationException("仅已提交版本允许撤回", Map.of(
                    "versionId", version.id(),
                    "versionStatus", version.versionStatus()
            ));
        }
        if ("locked".equals(version.lockStatus())) {
            throw new ResourceLockedException("当前清单版本已锁定，不能撤回", Map.of(
                    "versionId", version.id(),
                    "lockStatus", version.lockStatus()
            ));
        }
        return billVersionRepository.updateVersionStatus(versionId, "editable");
    }

    @Override
    public BillVersionValidationSummary getValidationSummary(UUID projectId, UUID versionId) {
        BillVersionContext version = requireVersion(projectId, versionId);
        authorizationService.assertCanViewContext(projectId, version.stageCode(), version.disciplineCode(), version.businessIdentity());
        return buildValidationSummary(version);
    }

    private BillVersionResponse toResponse(BillVersionContext context) {
        return billVersionRepository.findByProjectId(context.projectId(), context.stageCode(), context.disciplineCode()).stream()
                .filter(item -> item.id().equals(context.id()))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("清单版本不存在"));
    }

    private void copyBillItemsAndWorkItems(UUID sourceVersionId, UUID targetVersionId) {
        List<BillItemResponse> sourceItems = billItemRepository.findByBillVersionId(sourceVersionId);
        Map<UUID, UUID> itemIdMap = new java.util.HashMap<>();
        sourceItems.forEach(item -> itemIdMap.put(item.id(), UUID.randomUUID()));

        for (BillItemResponse sourceItem : sourceItems) {
            BillItemResponse clonedItem = new BillItemResponse(
                    itemIdMap.get(sourceItem.id()),
                    targetVersionId,
                    sourceItem.parentId() == null ? null : itemIdMap.get(sourceItem.parentId()),
                    sourceItem.itemLevel(),
                    sourceItem.sortOrder(),
                    sourceItem.itemCode(),
                    sourceItem.itemName(),
                    sourceItem.unit(),
                    sourceItem.sourceBillId(),
                    sourceItem.sourceSequence(),
                    sourceItem.sourceLevelCode(),
                    sourceItem.isMeasureItem(),
                    sourceItem.quantity(),
                    sourceItem.featureRuleText(),
                    sourceItem.sourceReferencePrice(),
                    sourceItem.sourceFeeId(),
                    sourceItem.measureCategory(),
                    sourceItem.measureFeeFlag(),
                    sourceItem.measureCategorySubtype(),
                    sourceItem.systemUnitPrice(),
                    sourceItem.manualUnitPrice(),
                    sourceItem.finalUnitPrice(),
                    sourceItem.systemAmount(),
                    sourceItem.finalAmount(),
                    sourceItem.taxRate(),
                    sourceItem.sourceVersionLabel(),
                    sourceItem.lockStatus(),
                    sourceItem.validationStatus(),
                    sourceItem.remark()
            );
            billItemRepository.save(clonedItem);

            List<BillItemWorkItemResponse> workItems = billItemWorkItemRepository.findByBillItemId(sourceItem.id());
            for (BillItemWorkItemResponse workItem : workItems) {
                billItemWorkItemRepository.save(new BillItemWorkItemResponse(
                        UUID.randomUUID(),
                        clonedItem.id(),
                        workItem.sourceSpecCode(),
                        workItem.sourceBillId(),
                        workItem.sortOrder(),
                        workItem.workContent(),
                        workItem.createdAt()
                ));
            }
        }
    }

    private void assertEditable(BillVersionContext version) {
        if (!"editable".equals(version.versionStatus()) || "locked".equals(version.lockStatus())) {
            throw new ResourceLockedException("当前清单版本不可提交或编辑", Map.of(
                    "versionId", version.id(),
                    "versionStatus", version.versionStatus(),
                    "lockStatus", version.lockStatus()
            ));
        }
    }

    private BillVersionContext requireVersion(UUID projectId, UUID versionId) {
        BillVersionContext version = billVersionRepository.findById(versionId)
                .orElseThrow(() -> new NotFoundException("清单版本不存在"));
        if (!version.projectId().equals(projectId)) {
            throw new NotFoundException("清单版本不存在");
        }
        return version;
    }

    private BillVersionValidationSummary buildValidationSummary(BillVersionContext version) {
        List<BillVersionValidationIssue> issues = new ArrayList<>();
        List<BillItemResponse> items = billItemRepository.findByBillVersionId(version.id());
        if (items.isEmpty()) {
            issues.add(new BillVersionValidationIssue(
                    "EMPTY_VERSION",
                    "error",
                    "清单版本至少需要包含一条清单项",
                    null,
                    null
            ));
        } else {
            Map<String, Integer> itemCodeCounts = new HashMap<>();
            for (BillItemResponse item : items) {
                if (item.itemCode() != null && !item.itemCode().isBlank()) {
                    itemCodeCounts.merge(item.itemCode(), 1, Integer::sum);
                }
            }
            for (BillItemResponse item : items) {
                if (item.itemCode() != null && itemCodeCounts.getOrDefault(item.itemCode(), 0) > 1) {
                    issues.add(new BillVersionValidationIssue(
                            "DUPLICATE_ITEM_CODE",
                            "error",
                            "清单项编码 %s 存在重复".formatted(item.itemCode()),
                            item.itemCode(),
                            item.id().toString()
                    ));
                    break;
                }
                if (billItemWorkItemRepository.findByBillItemId(item.id()).isEmpty()) {
                    issues.add(new BillVersionValidationIssue(
                            "MISSING_WORK_ITEMS",
                            "warning",
                            "清单项 %s 缺少工作内容".formatted(item.itemCode()),
                            item.itemCode(),
                            item.id().toString()
                    ));
                }
            }
        }
        long errorCount = issues.stream().filter(item -> "error".equals(item.severity())).count();
        long warningCount = issues.stream().filter(item -> "warning".equals(item.severity())).count();
        return new BillVersionValidationSummary(
                version.id(),
                errorCount == 0,
                (int) errorCount,
                (int) warningCount,
                issues
        );
    }
}
