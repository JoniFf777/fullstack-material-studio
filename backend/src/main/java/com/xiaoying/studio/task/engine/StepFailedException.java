package com.xiaoying.studio.task.engine;
public class StepFailedException extends RuntimeException {
    private final String code;
    public StepFailedException(String code,String message){super(message);this.code=code;}
    public String code(){return code;}
}
