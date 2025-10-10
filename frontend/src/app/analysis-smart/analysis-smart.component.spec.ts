import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalysisSmartComponentComponent } from './analysis-smart.component';

describe('AnalysisSmartComponentComponent', () => {
  let component: AnalysisSmartComponentComponent;
  let fixture: ComponentFixture<AnalysisSmartComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisSmartComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalysisSmartComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
