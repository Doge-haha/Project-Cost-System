package com.xindian.saaspricing.bill.service;

import com.xindian.saaspricing.auth.ProjectScopedAuthorizationService;
import com.xindian.saaspricing.bill.dto.BillItemResponse;
import com.xindian.saaspricing.bill.dto.BillItemWorkItemResponse;
import com.xindian.saaspricing.bill.dto.BillVersionContext;
import com.xindian.saaspricing.bill.dto.CreateBillItemRequest;
import com.xindian.saaspricing.bill.dto.CreateBillItemWorkItemRequest;
import com.xindian.saaspricing.bill.dto.UpdateBillItemRequest;
import com.xindian.saaspricing.bill.repository.BillItemRepository;
import com.xindian.saaspricing.bill.repository.BillItemWorkItemRepository;
import com.xindian.saaspricing.bill.repository.BillVersionRepository;
import com.xindian.saaspricing.common.exception.NotFoundException;
import com.xindian.saaspricing.common.exception.ResourceLockedException;
import com.xindian.saaspricing.common.exception.ValidationException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class BillItemServiceImpl implements BillItemService {

    private final BillVersionRepository billVersionRepository;
    private final BillItemRepository billItemRepository;
    private final BillItemWorkItemRepository billItemWorkItemRepository;
    private final ProjectScopedAuthorizationService authorizationService;

    public BillItemServiceImpl(
            BillVersionRepository billVersionRepository,
            BillItemRepository billItemRepository,
            BillItemWorkItemRepository billItemWorkItemRepository,
            ProjectScopedAuthorizationService authorizationService
    ) {
        this.billVersionRepository = billVersionRepository;
        this.billItemRepository = billItemRepository;
        this.billItemWorkItemRepository = billItemWorkItemRepository;
        this.authorizationService = authorizationService;
    }

    @Override
    public List<BillItemResponse> listBillItems(UUID projectId, UUID billVersionId) {
        BillVersionContext version = requireVersion(projectId, billVersionId);
        authorizationService.assertCanViewContext(projectId, version.stageCode(), version.disciplineCode(), version.businessIdentity());
        return billItemRepository.findByBillVersionId(billVersionId);
    }

    @Override
    public BillItemResponse createBillItem(UUID projectId, CreateBillItemRequest request) {
        BillVersionContext version = requireVersion(projectId, request.billVersionId());
        assertEditable(version);
        authorizationService.assertCanEditContext(projectId, version.stageCode(), version.disciplineCode(), version.businessIdentity());
        validateParentItem(request.billVersionId(), request.parentId());
        BillItemResponse item = new BillItemResponse(
                UUID.randomUUID(),
                request.billVersionId(),
                request.parentId(),
                request.itemLevel(),
                request.sortOrder(),
                request.itemCode(),
                request.itemName(),
                request.unit(),
                request.sourceBillId(),
                request.sourceSequence(),
                request.sourceLevelCode(),
                request.isMeasureItem() != null && request.isMeasureItem(),
                request.quantity(),
                request.featureRuleText(),
                request.sourceReferencePrice(),
                request.sourceFeeId(),
                request.measureCategory(),
                request.measureFeeFlag(),
                request.measureCategorySubtype(),
                null,
                null,
                null,
                null,
                null,
                request.taxRate(),
                null,
                "unlocked",
                "normal",
                request.remark()
        );
        return billItemRepository.save(item);
    }

    @Override
    public BillItemResponse updateBillItem(UUID projectId, UUID itemId, UpdateBillItemRequest request) {
        BillItemResponse current = requireItem(itemId);
        BillVersionContext version = requireVersion(projectId, current.billVersionId());
        assertEditable(version);
        authorizationService.assertCanEditContext(projectId, version.stageCode(), version.disciplineCode(), version.businessIdentity());
        BillItemResponse updated = new BillItemResponse(
                current.id(),
                current.billVersionId(),
                current.parentId(),
                current.itemLevel(),
                current.sortOrder(),
                request.itemCode() != null ? request.itemCode() : current.itemCode(),
                request.itemName() != null ? request.itemName() : current.itemName(),
                request.unit() != null ? request.unit() : current.unit(),
                current.sourceBillId(),
                current.sourceSequence(),
                request.sourceLevelCode() != null ? request.sourceLevelCode() : current.sourceLevelCode(),
                request.isMeasureItem() != null ? request.isMeasureItem() : current.isMeasureItem(),
                request.quantity() != null ? request.quantity() : current.quantity(),
                request.featureRuleText() != null ? request.featureRuleText() : current.featureRuleText(),
                request.sourceReferencePrice() != null ? request.sourceReferencePrice() : current.sourceReferencePrice(),
                current.sourceFeeId(),
                request.measureCategory() != null ? request.measureCategory() : current.measureCategory(),
                request.measureFeeFlag() != null ? request.measureFeeFlag() : current.measureFeeFlag(),
                request.measureCategorySubtype() != null ? request.measureCategorySubtype() : current.measureCategorySubtype(),
                current.systemUnitPrice(),
                request.manualUnitPrice() != null ? request.manualUnitPrice() : current.manualUnitPrice(),
                current.finalUnitPrice(),
                current.systemAmount(),
                current.finalAmount(),
                request.taxRate() != null ? request.taxRate() : current.taxRate(),
                current.sourceVersionLabel(),
                current.lockStatus(),
                current.validationStatus(),
                request.remark() != null ? request.remark() : current.remark()
        );
        return billItemRepository.update(updated);
    }

    @Override
    public List<BillItemWorkItemResponse> listWorkItems(UUID projectId, UUID itemId) {
        BillItemResponse item = requireItem(itemId);
        BillVersionContext version = requireVersion(projectId, item.billVersionId());
        authorizationService.assertCanViewContext(projectId, version.stageCode(), version.disciplineCode(), version.businessIdentity());
        return billItemWorkItemRepository.findByBillItemId(itemId);
    }

    @Override
    public BillItemWorkItemResponse createWorkItem(UUID projectId, UUID itemId, CreateBillItemWorkItemRequest request) {
        BillItemResponse item = requireItem(itemId);
        BillVersionContext version = requireVersion(projectId, item.billVersionId());
        assertEditable(version);
        authorizationService.assertCanEditContext(projectId, version.stageCode(), version.disciplineCode(), version.businessIdentity());
        BillItemWorkItemResponse workItem = new BillItemWorkItemResponse(
                UUID.randomUUID(),
                itemId,
                request.sourceSpecCode(),
                request.sourceBillId(),
                request.sortOrder(),
                request.workContent(),
                OffsetDateTime.now()
        );
        return billItemWorkItemRepository.save(workItem);
    }

    @Override
    public BillItemWorkItemResponse updateWorkItem(UUID projectId, UUID itemId, UUID workItemId, CreateBillItemWorkItemRequest request) {
        BillItemResponse item = requireItem(itemId);
        BillItemWorkItemResponse current = billItemWorkItemRepository.findById(workItemId)
                .orElseThrow(() -> new NotFoundException("清单工作内容不存在"));
        if (!current.billItemId().equals(itemId)) {
            throw new ValidationException("工作内容与清单项不匹配", Map.of("itemId", itemId, "workItemId", workItemId));
        }
        BillVersionContext version = requireVersion(projectId, item.billVersionId());
        assertEditable(version);
        authorizationService.assertCanEditContext(projectId, version.stageCode(), version.disciplineCode(), version.businessIdentity());
        BillItemWorkItemResponse updated = new BillItemWorkItemResponse(
                current.id(),
                current.billItemId(),
                current.sourceSpecCode(),
                current.sourceBillId(),
                request.sortOrder() != null ? request.sortOrder() : current.sortOrder(),
                request.workContent() != null ? request.workContent() : current.workContent(),
                current.createdAt()
        );
        return billItemWorkItemRepository.update(updated);
    }

    private BillVersionContext requireVersion(UUID projectId, UUID billVersionId) {
        BillVersionContext version = billVersionRepository.findById(billVersionId)
                .orElseThrow(() -> new NotFoundException("清单版本不存在"));
        if (!version.projectId().equals(projectId)) {
            throw new NotFoundException("清单版本不存在");
        }
        return version;
    }

    private BillItemResponse requireItem(UUID itemId) {
        return billItemRepository.findById(itemId)
                .orElseThrow(() -> new NotFoundException("清单项不存在"));
    }

    private void assertEditable(BillVersionContext version) {
        if (!"editable".equals(version.versionStatus()) || "locked".equals(version.lockStatus())) {
            throw new ResourceLockedException("当前清单版本不可编辑", Map.of(
                    "versionId", version.id(),
                    "versionStatus", version.versionStatus(),
                    "lockStatus", version.lockStatus()
            ));
        }
    }

    private void validateParentItem(UUID billVersionId, UUID parentId) {
        if (parentId == null) {
            return;
        }
        BillItemResponse parent = billItemRepository.findById(parentId)
                .orElseThrow(() -> new ValidationException("父级清单项不存在", Map.of("parentId", parentId)));
        if (!parent.billVersionId().equals(billVersionId)) {
            throw new ValidationException("父级清单项必须属于同一清单版本", Map.of(
                    "parentId", parentId,
                    "parentBillVersionId", parent.billVersionId(),
                    "billVersionId", billVersionId
            ));
        }
    }
}
