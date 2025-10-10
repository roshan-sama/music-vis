import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeypointAnalysisPresentationComponent } from './keypoint-analysis-presentation.component';

describe('KeypointOverlayComponent', () => {
  let component: KeypointAnalysisPresentationComponent;
  let fixture: ComponentFixture<KeypointAnalysisPresentationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeypointAnalysisPresentationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KeypointAnalysisPresentationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
