package com.lifelab.common.text;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;

public final class SearchExpressions {
    private SearchExpressions() {
    }

    public static Expression<String> normalized(Expression<String> value, CriteriaBuilder builder) {
        return builder.function("lifelab_search_normalize", String.class, value);
    }
}
