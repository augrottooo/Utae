package com.utae.catalog;
import static org.junit.jupiter.api.Assertions.*;
import java.lang.reflect.Method;
import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;
class CatalogMapperScopeTest {
    @Test void everyUserVisibleMapperQueryAppliesCurrentUserAccessPredicate() throws Exception {
        for (Method method : CatalogMapper.class.getDeclaredMethods()) {
            Select sql = method.getAnnotation(Select.class);
            if (sql == null) continue;
            String query = String.join("", sql.value());
            assertTrue(query.contains("lifecycle_status='ACTIVE'") && query.contains("userId"), method.getName());
        }
    }
}
