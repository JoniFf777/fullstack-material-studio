package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import java.util.Map;
import com.xiaoying.studio.common.ApiException;
import com.xiaoying.studio.task.TaskStage;
import com.xiaoying.studio.simulation.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
class SimulationSettingsTest {
    private SimulationSettings settings(){return new SimulationSettings(new SimulationProperties("NONE",1500,4000,1500));}
    @Test void patchResetAndImmutableSnapshot() {
        var settings=settings();var before=settings.snapshot();
        settings.patch(new SimulationSettings.Patch("GENERATING",Map.of("GENERATING",100),true));
        assertEquals(1500,settings.get().delaysMs().get(TaskStage.MATERIAL_CHECK));
        assertEquals(100,settings.get().delaysMs().get(TaskStage.GENERATING));
        assertEquals("NONE",before.failStage());assertEquals(4000,before.delaysMs().get(TaskStage.GENERATING));
        assertTrue(settings.get().queryOutage());
        settings.reset();assertEquals(before,settings.snapshot());assertFalse(settings.get().queryOutage());
    }
    @Test void rejectsInvalidFieldsWithoutPartialUpdate() {
        var settings=settings();var before=settings.get();
        for(var patch:new SimulationSettings.Patch[]{new SimulationSettings.Patch("BAD",null,null),
                new SimulationSettings.Patch(null,Map.of("GENERATING",-1),null),
                new SimulationSettings.Patch(null,Map.of("GENERATING",60001),null),
                new SimulationSettings.Patch(null,Map.of("BAD",1),null)})assertThrows(ApiException.class,()->settings.patch(patch));
        assertEquals(before,settings.get());
    }
    @Test void snapshotRoundTripsAsJson() {
        var json=JsonMapper.builder().build();var snapshot=settings().snapshot();
        assertEquals(snapshot,json.readValue(json.writeValueAsString(snapshot),SimulationPlan.class));
        assertFalse(json.readTree(json.writeValueAsString(snapshot)).has("queryOutage"));
    }
}
