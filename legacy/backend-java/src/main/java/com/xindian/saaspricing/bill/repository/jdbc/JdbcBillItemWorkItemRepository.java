package com.xindian.saaspricing.bill.repository.jdbc;

import com.xindian.saaspricing.bill.dto.BillItemWorkItemResponse;
import com.xindian.saaspricing.bill.repository.BillItemWorkItemRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcBillItemWorkItemRepository implements BillItemWorkItemRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcBillItemWorkItemRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<BillItemWorkItemResponse> findByBillItemId(UUID billItemId) {
        return jdbcTemplate.query(
                "select * from bill_item_work_item where bill_item_id = ? order by sort_order asc",
                (rs, rowNum) -> mapWorkItem(rs),
                billItemId
        );
    }

    @Override
    public Optional<BillItemWorkItemResponse> findById(UUID workItemId) {
        return jdbcTemplate.query(
                "select * from bill_item_work_item where id = ?",
                (rs, rowNum) -> mapWorkItem(rs),
                workItemId
        ).stream().findFirst();
    }

    @Override
    public BillItemWorkItemResponse save(BillItemWorkItemResponse workItem) {
        jdbcTemplate.update("""
                insert into bill_item_work_item (
                    id, bill_item_id, source_spec_code, source_bill_id, sort_order, work_content, created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                workItem.id(), workItem.billItemId(), workItem.sourceSpecCode(), workItem.sourceBillId(),
                workItem.sortOrder(), workItem.workContent(), workItem.createdAt(), workItem.createdAt()
        );
        return workItem;
    }

    @Override
    public BillItemWorkItemResponse update(BillItemWorkItemResponse workItem) {
        jdbcTemplate.update("""
                update bill_item_work_item
                   set sort_order = ?, work_content = ?, updated_at = now()
                 where id = ?
                """,
                workItem.sortOrder(), workItem.workContent(), workItem.id()
        );
        return workItem;
    }

    private BillItemWorkItemResponse mapWorkItem(ResultSet rs) throws SQLException {
        return new BillItemWorkItemResponse(
                rs.getObject("id", UUID.class),
                rs.getObject("bill_item_id", UUID.class),
                rs.getString("source_spec_code"),
                rs.getString("source_bill_id"),
                rs.getInt("sort_order"),
                rs.getString("work_content"),
                rs.getObject("created_at", OffsetDateTime.class)
        );
    }
}
