package com.xiaoying.studio.simulation;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/dev/simulation")
@ConditionalOnProperty(name="studio.dev-api-enabled",havingValue="true")
public class DevSimulationController {
    private final SimulationSettings settings;
    public DevSimulationController(SimulationSettings settings){this.settings=settings;}
    @GetMapping public SimulationSettingsDto get(){return settings.get();}
    @PatchMapping(consumes="application/json") public SimulationSettingsDto patch(@RequestBody SimulationSettings.Patch patch){return settings.patch(patch);}
    @PostMapping("/reset") public SimulationSettingsDto reset(){return settings.reset();}
}
