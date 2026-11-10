package com.xiaoying.studio.task;
public enum TaskStage {
    MATERIAL_CHECK("素材检查"), GENERATING("模拟生成"), RESULT_ASSEMBLY("结果整理");
    private final String label;
    TaskStage(String label) {this.label=label;}
    public String label() {return label;}
}
