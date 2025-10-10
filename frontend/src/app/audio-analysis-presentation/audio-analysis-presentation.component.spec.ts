import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AudioAnalysisPresentationComponent } from './audio-analysis-presentation.component';

describe('AudioAnalysisPresentationComponent', () => {
  let component: AudioAnalysisPresentationComponent;
  let fixture: ComponentFixture<AudioAnalysisPresentationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioAnalysisPresentationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AudioAnalysisPresentationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
