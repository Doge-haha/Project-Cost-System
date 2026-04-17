package com.xindian.saaspricing.discipline.repository;

import com.xindian.saaspricing.discipline.dto.StandardSetResponse;

import java.util.List;

public interface StandardSetRepository {

    List<StandardSetResponse> findAll(String disciplineCode, String regionCode, String status);
}

