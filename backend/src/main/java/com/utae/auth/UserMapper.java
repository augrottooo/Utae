package com.utae.auth;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {
    @Select("SELECT id, username, password_hash, role, enabled FROM app_user WHERE username = #{username}")
    UserAccount find(String username);
    @Insert("INSERT INTO app_user(id,username,password_hash,role) VALUES(#{id},#{username},#{passwordHash},#{role})")
    void create(@Param("id") String id, @Param("username") String username,
                @Param("passwordHash") String passwordHash, @Param("role") String role);
}
