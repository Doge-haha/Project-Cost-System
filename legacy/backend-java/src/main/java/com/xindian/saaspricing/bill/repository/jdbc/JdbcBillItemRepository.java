package com.xindian.saaspricing.bill.repository.jdbc;

import com.xindian.saaspricing.bill.dto.BillItemResponse;
import com.xindian.saaspricing.bill.repository.BillItemRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcBillItemRepository implements BillItemRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcBillItemRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<BillItemResponse> findByBillVersionId(UUID billVersionId) {
        return jdbcTemplate.query(
                "select * from bill_item where bill_version_id = ? order by sort_order asc",
                (rs, rowNum) -> mapItem(rs),
                billVersionId
        );
    }

    @Override
    public Optional<BillItemResponse> findById(UUID itemId) {
        return jdbcTemplate.query(
                "select * from bill_item where id = ?",
                (rs, rowNum) -> mapItem(rs),
                itemId
        ).stream().findFirst();
    }

    @Override
    public BillItemResponse save(BillItemResponse item) {
        jdbcTemplate.update("""
                insert into bill_item (
                    id, bill_version_id, parent_id, item_level, sort_order, item_code, item_name, unit,
                    source_bill_id, source_sequence, source_level_code, is_measure_item, quantity,
                    feature_rule_text, source_reference_price, source_fee_id, measure_category, measure_fee_flag,
                    measure_category_subtype, system_unit_price, manual_unit_price, final_unit_price,
                    system_amount, final_amount, tax_rate, source_version_label, lock_status,
                    validation_status, remark
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                item.id(), item.billVersionId(), item.parentId(), item.itemLevel(), item.sortOrder(),
                item.itemCode(), item.itemName(), item.unit(), item.sourceBillId(), item.sourceSequence(),
                item.sourceLevelCode(), item.isMeasureItem(), item.quantity(), item.featureRuleText(),
                item.sourceReferencePrice(), item.sourceFeeId(), item.measureCategory(), item.measureFeeFlag(),
                item.measureCategorySubtype(), item.systemUnitPrice(), item.manualUnitPrice(), item.finalUnitPrice(),
                item.systemAmount(), item.finalAmount(), item.taxRate(), item.sourceVersionLabel(),
                item.lockStatus(), item.validationStatus(), item.remark()
        );
        return item;
    }

    @Override
    public BillItemResponse update(BillItemResponse item) {
        jdbcTemplate.update("""
                update bill_item
                   set item_code = ?, item_name = ?, unit = ?, source_level_code = ?, is_measure_item = ?,
                       quantity = ?, feature_rule_text = ?, source_reference_price = ?, manual_unit_price = ?,
                       tax_rate = ?, measure_category = ?, measure_fee_flag = ?, measure_category_subtype = ?,
                       remark = ?, updated_at = now()
                 where id = ?
                """,
                item.itemCode(), item.itemName(), item.unit(), item.sourceLevelCode(), item.isMeasureItem(),
                item.quantity(), item.featureRuleText(), item.sourceReferencePrice(), item.manualUnitPrice(),
                item.taxRate(), item.measureCategory(), item.measureFeeFlag(), item.measureCategorySubtype(),
                item.remark(), item.id()
        );
        return item;
    }

    private BillItemResponse mapItem(ResultSet rs) throws SQLException {
        return new BillItemResponse(
                rs.getObject("id", UUID.class),
                rs.getObject("bill_version_id", UUID.class),
                rs.getObject("parent_id", UUID.class),
                rs.getInt("item_level"),
                rs.getInt("sort_order"),
                rs.getString("item_code"),
                rs.getString("item_name"),
                rs.getString("unit"),
                rs.getString("source_bill_id"),
                getInteger(rs, "source_sequence"),
                rs.getString("source_level_code"),
                rs.getBoolean("is_measure_item"),
                rs.getBigDecimal("quantity"),
                rs.getString("feature_rule_text"),
                rs.getBigDecimal("source_reference_price"),
                rs.getString("source_fee_id"),
                rs.getString("measure_category"),
                rs.getString("measure_fee_flag"),
                rs.getString("measure_category_subtype"),
                rs.getBigDecimal("system_unit_price"),
                rs.getBigDecimal("manual_unit_price"),
                rs.getBigDecimal("final_unit_price"),
                rs.getBigDecimal("system_amount"),
                rs.getBigDecimal("final_amount"),
                rs.getBigDecimal("tax_rate"),
                rs.getString("source_version_label"),
                rs.getString("lock_status"),
                rs.getString("validation_status"),
                rs.getString("remark")
        );
    }

    private Integer getInteger(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }
}
