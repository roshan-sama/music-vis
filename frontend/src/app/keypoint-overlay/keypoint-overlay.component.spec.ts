import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeypointOverlayComponent } from './keypoint-overlay.component';

describe('KeypointOverlayComponent', () => {
  let component: KeypointOverlayComponent;
  let fixture: ComponentFixture<KeypointOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeypointOverlayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KeypointOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
